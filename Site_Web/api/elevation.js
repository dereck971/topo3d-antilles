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
    const { lat, lon } = req.query;

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

    // Validate coordinates are within covered regions
    const REGIONS = [
      { name: 'Antilles', latMin: 14.0, latMax: 18.5, lonMin: -65.0, lonMax: -60.0 },
      { name: 'Guyane', latMin: 2.0, latMax: 6.0, lonMin: -55.0, lonMax: -51.0 },
      { name: 'Réunion', latMin: -21.5, latMax: -20.8, lonMin: 55.0, lonMax: 56.0 }
    ];
    const inRegion = REGIONS.some(r => latitude >= r.latMin && latitude <= r.latMax && longitude >= r.lonMin && longitude <= r.lonMax);
    if (!inRegion) {
      return res.status(400).json({ error: 'Coordonnées hors zone couverte (Antilles, Guyane, Réunion)' });
    }

    // Fetch from IGN elevation API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      // Use URLSearchParams for safe parameter encoding
      const params = new URLSearchParams({ lon: longitude, lat: latitude });
      const url = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?${params}`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Topo3D-Antilles/1.0'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`IGN API returned ${response.status}`);
      }

      const data = await response.json();

      return res.status(200).json({
        elevation: data.elevation || 0,
        lat: latitude,
        lon: longitude,
        resolution: data.resolution || 5,
        source: 'IGN MNT'
      });

    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Request timeout' });
      }
      throw err;
    }

  } catch (error) {
    console.error('Elevation error:', error);
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
