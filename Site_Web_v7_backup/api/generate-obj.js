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
    const { geometry, elevation, resolution = '5m' } = req.body;

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

    // Validate geometry type
    if (!['Polygon', 'Point', 'LineString'].includes(geometry.type)) {
      return res.status(400).json({ error: `Unsupported geometry type: ${geometry.type}` });
    }

    // Generate simple OBJ mesh
    // In production, this would perform actual Delaunay triangulation
    const obj = generateOBJMesh(geometry, elevation, resolution);

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="parcelle_${Date.now()}.obj"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Length', Buffer.byteLength(obj, 'utf-8'));

    return res.status(200).send(obj);

  } catch (error) {
    console.error('OBJ generation error:', error);
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

function generateOBJMesh(geometry, elevation, resolution) {
  let obj = '# Topo3D-Antilles OBJ Export\n';
  obj += `# Generated: ${new Date().toISOString()}\n`;
  obj += `# Resolution: ${resolution}\n`;
  obj += `# Source: IGN LiDAR HD\n\n`;

  // Parse geometry coordinates
  let coords = [];
  const heights = elevation || [];

  if (geometry.type === 'Polygon' && geometry.coordinates && Array.isArray(geometry.coordinates[0])) {
    const ring = geometry.coordinates[0];
    coords = ring.map((c, idx) => {
      // Validate coordinate structure
      if (!Array.isArray(c) || c.length < 2) {
        throw new Error('Invalid coordinate format');
      }
      return {
        x: parseFloat(c[0]),
        y: parseFloat(c[1]),
        z: heights[idx] ? parseFloat(heights[idx]) : 0
      };
    });
  } else if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    coords = [{
      x: parseFloat(geometry.coordinates[0]),
      y: parseFloat(geometry.coordinates[1]),
      z: heights[0] ? parseFloat(heights[0]) : 0
    }];
  }

  // Validate coordinates
  if (coords.length === 0) {
    throw new Error('No valid coordinates to export');
  }

  // Validate coordinate values
  coords.forEach((coord, idx) => {
    if (isNaN(coord.x) || isNaN(coord.y) || isNaN(coord.z)) {
      throw new Error(`Invalid coordinate values at index ${idx}`);
    }
  });

  // Add vertices
  coords.forEach((coord, idx) => {
    obj += `v ${coord.x.toFixed(6)} ${coord.z.toFixed(2)} ${coord.y.toFixed(6)}\n`;
  });

  obj += '\n';

  // Add faces (simple triangulation)
  const vertexCount = coords.length;
  if (vertexCount >= 3) {
    for (let i = 1; i < vertexCount - 1; i++) {
      obj += `f ${1} ${i + 1} ${i + 2}\n`;
    }
  }

  // Add metadata
  obj += '\n# End of OBJ file\n';

  return obj;
}
