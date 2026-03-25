/**
 * contours.js — Marching Squares contour line extraction
 * Port of the client-side algorithm in carte.js
 */

/**
 * Extract contour line segments for a given level using Marching Squares
 * @param {number[][]} grid - 2D elevation grid
 * @param {number} level - Contour level (altitude)
 * @param {number} nRows - Number of rows
 * @param {number} nCols - Number of columns
 * @returns {Array} Array of segments [{x1,y1,x2,y2}, ...]
 */
function getContourSegs(grid, level, nRows, nCols) {
  const segs = [];

  function interp(za, zb) {
    return za !== zb ? (level - za) / (zb - za) : 0.5;
  }

  for (let r = 0; r < nRows - 1; r++) {
    for (let c = 0; c < nCols - 1; c++) {
      const z00 = grid[r][c];
      const z10 = grid[r][c + 1];
      const z01 = grid[r + 1][c];
      const z11 = grid[r + 1][c + 1];

      if (z00 == null || z10 == null || z01 == null || z11 == null) continue;

      const idx = (z00 >= level ? 8 : 0) | (z10 >= level ? 4 : 0) |
                  (z11 >= level ? 2 : 0) | (z01 >= level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;

      const top    = { x: c + interp(z00, z10), y: r };
      const right  = { x: c + 1,                y: r + interp(z10, z11) };
      const bottom = { x: c + interp(z01, z11), y: r + 1 };
      const left   = { x: c,                    y: r + interp(z00, z01) };

      const add = (a, b) => segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

      switch (idx) {
        case 1: case 14: add(left, bottom); break;
        case 2: case 13: add(bottom, right); break;
        case 3: case 12: add(left, right); break;
        case 4: case 11: add(top, right); break;
        case 5: add(left, top); add(bottom, right); break;
        case 6: case 9: add(top, bottom); break;
        case 7: case 8: add(left, top); break;
        case 10: add(top, right); add(left, bottom); break;
      }
    }
  }

  return segs;
}

/**
 * Chain contour segments into continuous polylines
 * @param {Array} segs - Array of segments [{x1,y1,x2,y2}, ...]
 * @returns {Array} Array of chains, each chain = [{x,y}, ...]
 */
function chainSegments(segs) {
  const chains = [];
  const used = new Array(segs.length).fill(false);
  const TOLERANCE = 0.5;

  function dist(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;

    const chain = [
      { x: segs[i].x1, y: segs[i].y1 },
      { x: segs[i].x2, y: segs[i].y2 }
    ];

    let extended = true;
    while (extended) {
      extended = false;
      const head = chain[0];
      const tail = chain[chain.length - 1];

      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        const s = segs[j];

        if (dist(tail.x, tail.y, s.x1, s.y1) < TOLERANCE) {
          chain.push({ x: s.x2, y: s.y2 });
          used[j] = true; extended = true;
        } else if (dist(tail.x, tail.y, s.x2, s.y2) < TOLERANCE) {
          chain.push({ x: s.x1, y: s.y1 });
          used[j] = true; extended = true;
        } else if (dist(head.x, head.y, s.x1, s.y1) < TOLERANCE) {
          chain.unshift({ x: s.x2, y: s.y2 });
          used[j] = true; extended = true;
        } else if (dist(head.x, head.y, s.x2, s.y2) < TOLERANCE) {
          chain.unshift({ x: s.x1, y: s.y1 });
          used[j] = true; extended = true;
        }
      }
    }

    if (chain.length >= 2) chains.push(chain);
  }

  return chains;
}

/**
 * Generate all contour lines from elevation grid
 * @param {Object} gridData - Output of fetchElevationGrid
 * @param {number} interval - Minor contour interval in meters (default 1)
 * @param {number} majorEvery - Major contour every N meters (default 5)
 * @returns {Array} [{level, isMajor, chains: [{x,y},...]}]
 */
export function generateContours(gridData, interval = 1, majorEvery = 5) {
  const { grid, nRows, nCols, zMin, zMax } = gridData;
  const contours = [];

  // Generate contour levels
  const startLevel = Math.ceil(zMin / interval) * interval;
  const endLevel = Math.floor(zMax / interval) * interval;

  for (let level = startLevel; level <= endLevel; level += interval) {
    const segs = getContourSegs(grid, level, nRows, nCols);
    if (segs.length === 0) continue;

    const chains = chainSegments(segs);
    const isMajor = Math.abs(level % majorEvery) < 0.001 ||
                    Math.abs(level % majorEvery - majorEvery) < 0.001;

    contours.push({ level, isMajor, chains });
  }

  console.log(`[contours] Generated ${contours.length} contour levels, ` +
              `${contours.reduce((s, c) => s + c.chains.length, 0)} chains`);

  return contours;
}

/**
 * Convert grid-space contour points to local metric coordinates
 * @param {Array} contours - Output of generateContours
 * @param {Object} gridData - Grid metadata
 * @returns {Array} Same structure but with metric x,y coordinates
 */
export function contoursToMetric(contours, gridData) {
  const { lats, lngs, mPerDegLat, mPerDegLng, bbox } = gridData;
  const originLat = bbox.minLat;
  const originLng = bbox.minLng;

  return contours.map(c => ({
    level: c.level,
    isMajor: c.isMajor,
    chains: c.chains.map(chain =>
      chain.map(pt => {
        // Interpolate lat/lng from grid indices
        const rowFrac = pt.y;
        const colFrac = pt.x;
        const lat = lats[0] + rowFrac * (lats[lats.length - 1] - lats[0]) / (lats.length - 1);
        const lng = lngs[0] + colFrac * (lngs[lngs.length - 1] - lngs[0]) / (lngs.length - 1);
        // Convert to local meters
        return {
          x: (lng - originLng) * mPerDegLng,
          y: (lat - originLat) * mPerDegLat,
          z: c.level
        };
      })
    )
  }));
}
