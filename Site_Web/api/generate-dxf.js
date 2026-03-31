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
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { geometry, contours } = req.body;

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

    // Validate contours if provided
    if (contours && !Array.isArray(contours)) {
      return res.status(400).json({ error: 'Invalid contours: must be an array' });
    }

    // Generate DXF R12 format
    const dxf = generateDXF(geometry, contours);

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="parcelle_${Date.now()}.dxf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Length', Buffer.byteLength(dxf, 'utf-8'));

    return res.status(200).send(dxf);

  } catch (error) {
    console.error('DXF generation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function applySecureCORS(res, req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && origin.endsWith('.topo3d-antilles.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin === 'https://www.topo3d-antilles.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

function generateDXF(geometry, contours = []) {
  // Calculate actual bounding box from geometry
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates) && geometry.coordinates[0]) {
    geometry.coordinates[0].forEach(coord => {
      if (!Array.isArray(coord) || coord.length < 2) return;
      const x = parseFloat(coord[0]);
      const y = parseFloat(coord[1]);
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    });
  }
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 100; maxY = 100; }

  let dxf = '0\nSECTION\n2\nHEADER\n';
  dxf += '9\n$ACADVER\n1\nAC1015\n';
  dxf += `9\n$EXTMIN\n10\n${minX.toFixed(6)}\n20\n${minY.toFixed(6)}\n`;
  dxf += `9\n$EXTMAX\n10\n${maxX.toFixed(6)}\n20\n${maxY.toFixed(6)}\n`;
  dxf += '0\nENDSEC\n';

  dxf += '0\nSECTION\n2\nTABLES\n';
  dxf += '0\nTABLE\n2\nLAYER\n70\n2\n';
  dxf += '0\nLAYER\n2\nPARCELLE\n70\n0\n62\n5\n6\nCONTINUOUS\n';
  dxf += '0\nLAYER\n2\nCONTOURS\n70\n0\n62\n3\n6\nCONTINUOUS\n';
  dxf += '0\nENDTAB\n';
  dxf += '0\nENDSEC\n';

  dxf += '0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n';

  dxf += '0\nSECTION\n2\nENTITIES\n';

  // Add parcelle boundary
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates) && geometry.coordinates[0]) {
    const ring = geometry.coordinates[0];
    if (ring.length >= 2) {
      dxf += '0\nLWPOLYLINE\n8\nPARCELLE\n';
      dxf += `90\n${ring.length}\n`;
      ring.forEach(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          const x = parseFloat(coord[0]);
          const y = parseFloat(coord[1]);
          if (!isNaN(x) && !isNaN(y)) {
            dxf += `10\n${x.toFixed(6)}\n20\n${y.toFixed(6)}\n`;
          }
        }
      });
      dxf += '0\n'; // Close polyline
    }
  }

  // Add contour lines
  if (Array.isArray(contours)) {
    contours.forEach((contour, idx) => {
      if (!Array.isArray(contour)) return;
      dxf += '0\nLWPOLYLINE\n8\nCONTOURS\n';
      dxf += `90\n${contour.length}\n`;
      dxf += '40\n0.2\n41\n0.2\n';
      contour.forEach(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          const x = parseFloat(coord[0]);
          const y = parseFloat(coord[1]);
          if (!isNaN(x) && !isNaN(y)) {
            dxf += `10\n${x.toFixed(6)}\n20\n${y.toFixed(6)}\n`;
          }
        }
      });
      dxf += '0\n';
    });
  }

  // Add title
  dxf += '0\nTEXT\n8\n0\n';
  dxf += `1\nTopo3D-Antilles - ${new Date().toLocaleDateString('fr-FR')}\n`;
  dxf += '10\n0.0\n20\n0.0\n40\n2.5\n';

  dxf += '0\nENDSEC\n';
  dxf += '0\nEOF\n';

  return dxf;
}
