import crypto from 'crypto';

const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

export default async function handler(req, res) {
  // Add request ID to all responses
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Apply secure CORS headers
  applySecureCORS(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/geo+json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { geometry, elevation, properties = {} } = req.body;

    if (!geometry) {
      return res.status(400).json({ error: 'Missing geometry' });
    }

    // Validate geometry structure
    if (!geometry.type || typeof geometry.type !== 'string') {
      return res.status(400).json({ error: 'Invalid geometry: missing or invalid type' });
    }

    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      return res.status(400).json({ error: 'Invalid geometry: missing or invalid coordinates' });
    }

    // Validate properties is an object
    if (typeof properties !== 'object' || properties === null) {
      return res.status(400).json({ error: 'Invalid properties: must be an object' });
    }

    // Validate elevation data if provided
    if (elevation && (!Array.isArray(elevation) || elevation.length === 0)) {
      return res.status(400).json({ error: 'Invalid elevation: must be a non-empty array' });
    }

    // Generate GeoJSON with elevation properties
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry,
          properties: {
            ...properties,
            elevation_min: Math.min(...(elevation || [0])),
            elevation_max: Math.max(...(elevation || [0])),
            elevation_mean: elevation ? elevation.reduce((a, b) => a + b, 0) / elevation.length : 0,
            area_m2: calculateArea(geometry),
            generated: new Date().toISOString(),
            source: 'Topo3D-Antilles',
            data_source: 'IGN LiDAR HD',
            precision: '±0.2m',
            crs: 'EPSG:4326'
          }
        }
      ],
      bbox: calculateBbox(geometry),
      crs: {
        type: 'name',
        properties: {
          name: 'EPSG:4326'
        }
      }
    };

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="parcelle_${Date.now()}.geojson"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.status(200).json(geojson);

  } catch (error) {
    console.error('GeoJSON generation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function applySecureCORS(res, req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && origin.endsWith('.topo3d-antilles.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin === 'https://topo3d-antilles.vercel.app') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

function calculateArea(geometry) {
  if (geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || !geometry.coordinates[0]) {
    return 0;
  }

  // Shoelace formula (simplified)
  const ring = geometry.coordinates[0];
  let area = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    if (!Array.isArray(ring[i]) || !Array.isArray(ring[i + 1])) continue;
    if (ring[i].length < 2 || ring[i + 1].length < 2) continue;

    const x1 = parseFloat(ring[i][0]);
    const y1 = parseFloat(ring[i][1]);
    const x2 = parseFloat(ring[i + 1][0]);
    const y2 = parseFloat(ring[i + 1][1]);

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) continue;

    area += (x1 * y2) - (x2 * y1);
  }

  // Rough conversion to m² (simplified, doesn't account for projection)
  return Math.abs(area) * 111000 * 111000;
}

function calculateBbox(geometry) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      const lon = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    } else if (Array.isArray(coords)) {
      coords.forEach(processCoords);
    }
  }

  if (geometry.coordinates) {
    processCoords(geometry.coordinates);
  }

  if (minLon === Infinity) return null;
  return [minLon, minLat, maxLon, maxLat];
}
