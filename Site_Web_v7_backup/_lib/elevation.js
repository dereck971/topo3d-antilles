/**
 * elevation.js — Fetches elevation grid from IGN RGE ALTI API
 * Port of the client-side logic in carte.js
 */

const IGN_ALTI_URL = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
const BATCH_SIZE = 150; // IGN API max points per request
const M_PER_DEG_LAT = 111000;

/**
 * Fetch elevation grid for a bounding box
 * @param {Object} bbox - {minLng, maxLng, minLat, maxLat}
 * @param {number} resolution - Grid spacing in meters (default 5)
 * @returns {Object} Grid data with elevations
 */
export async function fetchElevationGrid(bbox, resolution = 5) {
  const { minLng, maxLng, minLat, maxLat } = bbox;

  // Buffer 20m around bbox
  const bufDeg = 20 / M_PER_DEG_LAT;
  const bMinLat = minLat - bufDeg;
  const bMaxLat = maxLat + bufDeg;
  const bMinLng = minLng - bufDeg;
  const bMaxLng = maxLng + bufDeg;

  // Compute grid spacing in degrees
  const mPerDegLng = M_PER_DEG_LAT * Math.cos(((bMinLat + bMaxLat) / 2) * Math.PI / 180);
  const latStep = resolution / M_PER_DEG_LAT;
  const lngStep = resolution / mPerDegLng;

  // Build grid points
  const lats = [];
  const lngs = [];
  for (let lat = bMinLat; lat <= bMaxLat; lat += latStep) lats.push(lat);
  for (let lng = bMinLng; lng <= bMaxLng; lng += lngStep) lngs.push(lng);

  const nRows = lats.length;
  const nCols = lngs.length;
  const totalPoints = nRows * nCols;

  console.log(`[elevation] Grid ${nCols}x${nRows} = ${totalPoints} points, resolution ${resolution}m`);

  // Build flat list of all points (row-major: lat varies first)
  const allLats = [];
  const allLngs = [];
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      allLats.push(lats[r]);
      allLngs.push(lngs[c]);
    }
  }

  // Fetch in batches of 150
  const elevations = new Array(totalPoints).fill(null);
  const numBatches = Math.ceil(totalPoints / BATCH_SIZE);

  for (let b = 0; b < numBatches; b++) {
    const start = b * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, totalPoints);

    const batchLons = allLngs.slice(start, end).map(v => v.toFixed(7)).join('|');
    const batchLats = allLats.slice(start, end).map(v => v.toFixed(7)).join('|');

    const url = `${IGN_ALTI_URL}?lon=${batchLons}&lat=${batchLats}&resource=ign_rge_alti_wld&zonly=false`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`[elevation] Batch ${b + 1}/${numBatches} failed: ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const alts = data.elevations || [];
      for (let i = 0; i < alts.length; i++) {
        const z = alts[i]?.z ?? alts[i];
        elevations[start + i] = (z === -99999 || z === -9999 || z === null) ? null : z;
      }
    } catch (err) {
      console.warn(`[elevation] Batch ${b + 1}/${numBatches} error:`, err.message);
    }
  }

  // Build 2D grid
  const grid = [];
  let zMin = Infinity, zMax = -Infinity;
  for (let r = 0; r < nRows; r++) {
    const row = [];
    for (let c = 0; c < nCols; c++) {
      const z = elevations[r * nCols + c];
      row.push(z);
      if (z !== null) {
        if (z < zMin) zMin = z;
        if (z > zMax) zMax = z;
      }
    }
    grid.push(row);
  }

  // Interpolate null values using 8-neighbor average
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      if (grid[r][c] !== null) continue;
      let sum = 0, cnt = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < nRows && nc >= 0 && nc < nCols && grid[nr][nc] !== null) {
            sum += grid[nr][nc];
            cnt++;
          }
        }
      }
      grid[r][c] = cnt > 0 ? sum / cnt : zMin;
    }
  }

  // Recalculate min/max after interpolation
  zMin = Infinity; zMax = -Infinity;
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const z = grid[r][c];
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
  }

  return {
    grid,
    nCols,
    nRows,
    zMin,
    zMax,
    bbox: { minLng: bMinLng, maxLng: bMaxLng, minLat: bMinLat, maxLat: bMaxLat },
    lats,
    lngs,
    mPerDegLat: M_PER_DEG_LAT,
    mPerDegLng,
    resolution
  };
}

/**
 * Get parcel boundary from IGN Cadastre API
 * @param {string} codeInsee - INSEE commune code
 * @param {string} section - Cadastral section (e.g., "AB")
 * @param {string} numero - Parcel number (e.g., "0045")
 * @returns {Object} GeoJSON Feature
 */
export async function fetchParcelBoundary(codeInsee, section, numero) {
  const url = 'https://apicarto.ign.fr/api/cadastre/parcelle';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code_insee: codeInsee,
      section: section.toUpperCase(),
      numero: numero.padStart(4, '0')
    })
  });

  if (!resp.ok) throw new Error(`Cadastre API error: ${resp.status}`);
  const data = await resp.json();

  if (!data.features || data.features.length === 0) {
    throw new Error(`Parcelle non trouvee: ${codeInsee} ${section} ${numero}`);
  }

  return data.features[0];
}

/**
 * Compute bounding box from a GeoJSON geometry
 */
export function geometryBbox(geometry) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      // Single point [lng, lat]
      if (coords[0] < minLng) minLng = coords[0];
      if (coords[0] > maxLng) maxLng = coords[0];
      if (coords[1] < minLat) minLat = coords[1];
      if (coords[1] > maxLat) maxLat = coords[1];
    } else {
      coords.forEach(processCoords);
    }
  }

  processCoords(geometry.coordinates);
  return { minLng, maxLng, minLat, maxLat };
}
