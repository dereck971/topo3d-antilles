// Vercel Edge Middleware — Topo3D-Antilles
// Protects carte + API write routes, allows public landing pages + read APIs

const PUBLIC_PATHS = new Set([
  '/',
  '/index.html',
  '/comment-ca-marche.html',
  '/comment-ca-marche',
  '/references.html',
  '/references',
  '/cgv.html',
  '/cgv',
  '/confidentialite.html',
  '/confidentialite',
  '/login.html',
  '/api/login',
  '/api/logout',
  '/api/webhook',
  '/api/contours'
]);

const STATIC_EXT = /\.(woff2?|ttf|eot|css|js|png|jpe?g|gif|svg|webp|ico|json|xml|txt|pdf|map)$/i;

const PROTECTED_PATTERNS = [
  /^\/carte(\.html)?$/,
  /^\/api\/elevation$/,
  /^\/api\/generate-(obj|dxf|geojson)$/,
  /^\/api\/fiche-parcelle$/,
  /^\/api\/email$/
];

function getCookie(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? match[1] : null;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Always allow public paths and static assets
  if (PUBLIC_PATHS.has(pathname) || STATIC_EXT.test(pathname)) {
    return;
  }

  // Check if route is protected
  const isProtected = PROTECTED_PATTERNS.some(p => p.test(pathname));
  if (!isProtected) return;

  // Verify session cookie (format: timestamp_base36.hmac_sha256_hex)
  const session = getCookie(request, 'topo3d_session');
  if (session) {
    // Validate session format: must contain a dot separator and SHA-256 hex hash (64 chars)
    const parts = session.split('.');
    if (parts.length === 2 && parts[0].length > 0 && parts[1].length === 64) {
      // Check session age (max 7 days)
      const timestamp = parseInt(parts[0], 36);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (!isNaN(timestamp) && (now - timestamp) < maxAge) {
        return; // Valid session (HMAC validation happens server-side in API calls)
      }
    }
  }

  // Not authenticated → redirect to login
  return Response.redirect(new URL('/login.html', request.url), 302);
}
