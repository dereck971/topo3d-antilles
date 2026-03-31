import crypto from 'crypto';

const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

const REGIONS = [
  { name: 'Antilles', latMin: 14.0, latMax: 18.5, lonMin: -65.0, lonMax: -60.0 },
  { name: 'Guyane', latMin: 2.0, latMax: 6.0, lonMin: -55.0, lonMax: -51.0 },
  { name: 'Réunion', latMin: -21.5, latMax: -20.8, lonMin: 55.0, lonMax: 56.0 }
];

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // CORS
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || (origin && origin.endsWith('.topo3d-antilles.com')) || origin === 'https://www.topo3d-antilles.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { geometry, resolution: reqRes, threshold = 50, tier } = req.body || {};
    // LiDAR HD: use finer resolution for premium tiers
    const hdTiers = ['complet', 'premium', 'pro'];
    const resolution = reqRes || (hdTiers.includes(tier) ? 2 : 5);

    if (!geometry || geometry.type !== 'Polygon' || !geometry.coordinates?.[0]) {
      return res.status(400).json({ error: 'Invalid geometry. Expected GeoJSON Polygon.' });
    }

    const coords = geometry.coordinates[0];
    if (coords.length < 4) {
      return res.status(400).json({ error: 'Polygon must have at least 3 vertices.' });
    }

    // Validate centroid is in covered region
    const centLon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const centLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const inRegion = REGIONS.some(r => centLat >= r.latMin && centLat <= r.latMax && centLon >= r.lonMin && centLon <= r.lonMax);
    if (!inRegion) {
      return res.status(400).json({ error: 'Geometry outside covered regions (Antilles, Guyane, Réunion)' });
    }

    // Compute bounding box
    let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
    for (const c of coords) {
      lonMin = Math.min(lonMin, c[0]);
      lonMax = Math.max(lonMax, c[0]);
      latMin = Math.min(latMin, c[1]);
      latMax = Math.max(latMax, c[1]);
    }

    // Grid dimensions
    const latAvg = (latMin + latMax) / 2;
    const mPerDegLon = 111320 * Math.cos(latAvg * Math.PI / 180);
    const mPerDegLat = 110540;
    const widthM = (lonMax - lonMin) * mPerDegLon;
    const heightM = (latMax - latMin) * mPerDegLat;
    const cols = Math.min(200, Math.max(3, Math.ceil(widthM / resolution)));
    const rows = Math.min(200, Math.max(3, Math.ceil(heightM / resolution)));
    const totalCells = cols * rows;

    if (totalCells > 40000) {
      return res.status(400).json({ error: `Grid too large (${totalCells} cells). Reduce area or increase resolution.` });
    }

    // Fetch elevation grid from IGN
    const elevGrid = new Float32Array(totalCells);
    const batchSize = 50;
    const points = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lon = lonMin + (c + 0.5) * (lonMax - lonMin) / cols;
        const lat = latMax - (r + 0.5) * (latMax - latMin) / rows;
        points.push({ lon, lat, idx: r * cols + c });
      }
    }

    // Batch fetch elevations
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      const lons = batch.map(p => p.lon.toFixed(6)).join('|');
      const lats = batch.map(p => p.lat.toFixed(6)).join('|');
      const url = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lons}&lat=${lats}`;

      try {
        const resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Topo3D-Antilles/1.0' } });
        if (resp.ok) {
          const data = await resp.json();
          if (data.elevations) {
            data.elevations.forEach((elev, j) => {
              if (batch[j]) elevGrid[batch[j].idx] = elev || 0;
            });
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') {
          clearTimeout(timeout);
          return res.status(504).json({ error: 'Elevation fetch timeout' });
        }
      }
    }
    clearTimeout(timeout);

    // D8 Flow Direction
    const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
    const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
    const DIST = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414];
    const flowDir = new Int8Array(totalCells).fill(-1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const h = elevGrid[idx];
        let maxSlope = 0;
        let bestDir = -1;
        for (let d = 0; d < 8; d++) {
          const nr = r + DY[d], nc = c + DX[d];
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const nIdx = nr * cols + nc;
          const slope = (h - elevGrid[nIdx]) / (DIST[d] * resolution);
          if (slope > maxSlope) {
            maxSlope = slope;
            bestDir = d;
          }
        }
        flowDir[idx] = bestDir;
      }
    }

    // Flow Accumulation (topological sort by elevation)
    const accumulation = new Float32Array(totalCells).fill(1);
    const indices = Array.from({ length: totalCells }, (_, i) => i);
    indices.sort((a, b) => elevGrid[b] - elevGrid[a]); // highest first

    for (const idx of indices) {
      const dir = flowDir[idx];
      if (dir < 0) continue;
      const r = Math.floor(idx / cols), c = idx % cols;
      const nr = r + DY[dir], nc = c + DX[dir];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      accumulation[nr * cols + nc] += accumulation[idx];
    }

    // Extract drainage channels
    const channels = [];
    const visited = new Uint8Array(totalCells);

    for (let i = 0; i < totalCells; i++) {
      if (accumulation[i] >= threshold && !visited[i]) {
        const lineCoords = [];
        let idx = i;
        while (idx >= 0 && !visited[idx] && accumulation[idx] >= threshold) {
          visited[idx] = 1;
          const r = Math.floor(idx / cols), c = idx % cols;
          const lon = lonMin + (c + 0.5) * (lonMax - lonMin) / cols;
          const lat = latMax - (r + 0.5) * (latMax - latMin) / rows;
          lineCoords.push([lon, lat]);
          const dir = flowDir[idx];
          if (dir < 0) break;
          const nr = r + DY[dir], nc = c + DX[dir];
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
          idx = nr * cols + nc;
        }
        if (lineCoords.length >= 2) {
          channels.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: lineCoords },
            properties: { maxAccumulation: Math.max(...lineCoords.map((_, j) => {
              const ci = Math.round((lineCoords[j][0] - lonMin) / (lonMax - lonMin) * cols - 0.5);
              const ri = Math.round((latMax - lineCoords[j][1]) / (latMax - latMin) * rows - 0.5);
              return accumulation[Math.max(0, Math.min(ri * cols + ci, totalCells - 1))];
            })) }
          });
        }
      }
    }

    // Summary stats
    let maxAcc = 0, sumAcc = 0;
    for (let i = 0; i < totalCells; i++) {
      maxAcc = Math.max(maxAcc, accumulation[i]);
      sumAcc += accumulation[i];
    }

    return res.status(200).json({
      grid: {
        width: cols,
        height: rows,
        bbox: [lonMin, latMin, lonMax, latMax],
        cellSize: resolution
      },
      drainageChannels: {
        type: 'FeatureCollection',
        features: channels
      },
      summary: {
        maxAccumulation: Math.round(maxAcc),
        avgAccumulation: Math.round(sumAcc / totalCells * 10) / 10,
        totalCells,
        channelCount: channels.length
      }
    });

  } catch (error) {
    console.error('Runoff computation error:', error);
    return res.status(500).json({ error: 'Internal server error', requestId });
  }
}
