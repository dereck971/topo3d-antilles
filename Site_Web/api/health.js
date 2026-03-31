export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://topo3d-antilles.com');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  res.status(200).json({
    status: 'ok',
    service: 'topo3d-antilles',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    env: {
      stripe:  !!process.env.STRIPE_WEBHOOK_SECRET,
      resend:  !!process.env.RESEND_API_KEY,
      session: !!process.env.SESSION_SECRET,
      kv:      !!process.env.KV_REST_API_URL
    }
  });
}
