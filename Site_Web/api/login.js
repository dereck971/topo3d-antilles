import crypto from 'crypto';

// Global state (in production, use database)
// Note: rateLimits Map is volatile and cleared on server restart
const rateLimits = new Map();

const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

export default function handler(req, res) {
  // Add request ID to all responses
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Apply secure CORS headers
  applySecureCORS(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user, pass } = req.body;

    if (!user || !pass) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // Rate limiting (5 attempts per minute per IP)
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
    const ipKey = `login:${ip}`;
    const now = Date.now();
    const limiter = rateLimits.get(ipKey) || { count: 0, resetAt: now + 60000 };

    if (limiter.resetAt < now) {
      limiter.count = 0;
      limiter.resetAt = now + 60000;
    }

    if (limiter.count >= 5) {
      rateLimits.set(ipKey, limiter);
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }

    limiter.count++;
    rateLimits.set(ipKey, limiter);

    // Check credentials against env vars (REQUIRED - no fallback)
    const validUser = process.env.BETA_USER;
    const validPass = process.env.BETA_PASS;

    if (!validUser || !validPass) {
      console.error('BETA_USER and BETA_PASS environment variables are required');
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    if (user !== validUser || pass !== validPass) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate session token with HMAC (format: timestamp_base36.hmac_sha256_hex)
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.error('SESSION_SECRET environment variable is required');
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    const timestamp = Date.now().toString(36);
    const hmac = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
    const sessionToken = `${timestamp}.${hmac}`;

    // Set cookies
    const cookieOptions = [
      `topo3d_session=${sessionToken}`,
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=86400',
      'Path=/'
    ].join('; ');

    const betaCookie = [
      'topo3d_beta=true',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=86400',
      'Path=/'
    ].join('; ');

    res.setHeader('Set-Cookie', [cookieOptions, betaCookie]);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Login error:', error);
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
  // No wildcard fallback — unlisted origins are blocked
}
