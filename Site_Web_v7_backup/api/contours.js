import crypto from 'crypto';

const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

export default async function handler(req, res) {
  // Add request ID to all responses
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Apply secure CORS headers
  applySecureCORS(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lat, lon, code_insee } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing lat or lon parameter' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Coordinates out of range' });
    }

    // Validate coordinates are within Antilles region
    const LAT_MIN = 14.0, LAT_MAX = 18.5, LON_MIN = -65.0, LON_MAX = -60.0;
    if (latitude < LAT_MIN || latitude > LAT_MAX || longitude < LON_MIN || longitude > LON_MAX) {
      return res.status(400).json({ error: 'Coordonnées hors zone couverte (Antilles)' });
    }

    // Fetch from API Cadastre with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      // Use URLSearchParams for safe parameter encoding
      const params = new URLSearchParams({ lon: longitude, lat: latitude });
      const url = `https://apicarto.ign.fr/api/cadastre/parcelle?${params}`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Topo3D-Antilles/1.0'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(404).json({
          error: 'Parcelle not found',
          message: 'The coordinates do not correspond to a cadastral parcel'
        });
      }

      const data = await response.json();

      // Parse parcelle data
      const parcelle = data.features && data.features[0];

      if (!parcelle) {
        return res.status(404).json({ error: 'No parcelle found at these coordinates' });
      }

      const props = parcelle.properties || {};
      const geometry = parcelle.geometry || {};

      return res.status(200).json({
        type: 'Feature',
        geometry,
        properties: {
          commune: props.commune || 'Unknown',
          section: props.section || 'Unknown',
          numero: props.numero || 'Unknown',
          surface: props.surface || 0,
          address: props.address || 'N/A',
          lat: latitude,
          lon: longitude,
          codeInsee: props.codeInsee || code_insee,
          feuille: props.feuille || 'Unknown'
        },
        source: 'API Cadastre IGN'
      });

    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Request timeout' });
      }
      throw err;
    }

  } catch (error) {
    console.error('Contours error:', error);
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
