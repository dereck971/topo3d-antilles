const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

export default function handler(req, res) {
  // Apply secure CORS
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && origin.endsWith('.topo3d-antilles.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin === 'https://www.topo3d-antilles.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear session cookies
  res.setHeader('Set-Cookie', [
    'topo3d_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
    'topo3d_beta=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/'
  ]);

  return res.status(200).json({ ok: true });
}
