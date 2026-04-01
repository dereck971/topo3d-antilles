# Topo3D-Antilles Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Variables (Vercel Dashboard)
Before deploying, configure these in Vercel project settings:

```bash
BETA_USER=admin              # Username for beta access
BETA_PASS=<YOUR_SECURE_PASSWORD>  # REQUIRED: Set a strong password
RESEND_API_KEY=re_xxxxx      # Get from https://resend.com
STRIPE_WEBHOOK_SECRET=whsec_ # Get from Stripe Dashboard
```

### 2. Static Assets Required
These files need to be added to the project root:
- `hero-topo3d.webp` - Hero background image for landing & login pages
- Fonts from Google Fonts (linked via CDN, no local files needed)

### 3. DNS & Domain
- Point your domain to Vercel (CNAME: cname.vercel.com)
- Update `index.html` canonical URLs if using custom domain
- Update `middleware.js` domain handling if needed

## Deployment Steps

### Step 1: Clone/Deploy to Vercel
```bash
# Option A: Connect GitHub repository to Vercel
# Automatic deployments on git push

# Option B: Deploy via Vercel CLI
npm install -g vercel
vercel
```

### Step 2: Verify Configuration
```bash
# In Vercel Dashboard:
1. Settings → Environment Variables (add all 4 vars above)
2. Settings → Git (connect repository)
3. Deployments → Automatic Deployments enabled
```

### Step 3: Test Authentication
1. Visit: https://your-domain.com/login.html
2. Enter credentials from env vars
3. Should redirect to /carte.html (interactive map)
4. Check browser DevTools → Cookies:
   - `topo3d_session` should be present (httpOnly)
   - `topo3d_beta=true` should be present

### Step 4: Test Routes
- `/` - Landing page (light theme)
- `/comment-ca-marche` - How it works guide
- `/references.html` - Legal/references page
- `/login.html` - Login page (public)
- `/carte.html` - Interactive map (protected, redirects to login if not authenticated)

### Step 5: Test API Endpoints
```bash
# Login (get session cookie)
curl -X POST https://your-domain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"user":"<BETA_USER>","pass":"<BETA_PASS>"}'

# Elevation endpoint (requires session)
curl https://your-domain.com/api/elevation?lat=16.25&lon=-61.55

# Contours endpoint
curl https://your-domain.com/api/contours?lat=16.25&lon=-61.55
```

### Step 6: Verify Security Headers
```bash
curl -I https://your-domain.com
# Should include:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Referrer-Policy: strict-origin-when-cross-origin
```

## Post-Deployment

### 1. Update External Configuration
- [ ] Update Stripe webhook URL in Dashboard:
  - Endpoint: `https://your-domain.com/api/webhook`
  - Events: `checkout.session.completed`

- [ ] Configure Resend (if using email):
  - Verify domain: `commandes@topo3d-antilles.com`
  - Create API key and set as `RESEND_API_KEY`

### 2. Test Maps & API Integration
1. Login and open interactive map at `/carte.html`
2. Verify:
   - MapLibre GL loads
   - Tab switching (Guadeloupe/Martinique) works
   - Layer toggles work
   - Side panel opens/closes

### 3. Monitor Logs
In Vercel Dashboard:
- Check Function Logs for API errors
- Monitor Runtime Logs for application errors
- Review analytics for traffic patterns

### 4. Backup & Recovery
- Set up automatic backups for any persistent data
- Document all environment variables
- Keep git repository up to date

## Troubleshooting

### Middleware Issues
If routes aren't being protected:
1. Verify `middleware.js` is in project root
2. Check `vercel.json` matcher configuration
3. Restart deployment after middleware changes

### API Timeout Errors
If external APIs (IGN, Cadastre) are slow:
1. Increase function timeout in `vercel.json` (up to 300s on Pro plan)
2. Implement request retries with exponential backoff
3. Cache responses from slow APIs

### Email Not Sending
If Resend integration fails:
1. Verify `RESEND_API_KEY` is set correctly
2. Check Resend dashboard for delivery status
3. Test with simple text email first

### Map Not Loading
If MapLibre GL doesn't initialize:
1. Check browser console for JS errors
2. Verify CDN URL: `https://unpkg.com/maplibre-gl@4.1.2/dist/maplibre-gl.js`
3. Check CORS headers in response

## Performance Optimization

### 1. Image Optimization
- Convert PNG/JPG to WebP for hero-topo3d.webp
- Target: < 500KB for optimal load times
- Use responsive images if possible

### 2. Code Splitting
- Consider splitting `carte.html` into smaller chunks
- Lazy load MapLibre GL only on /carte route

### 3. Caching
- Static assets: 1 year cache (set in vercel.json)
- API responses: Implement cache headers
- Database: Add caching layer for frequently accessed data

### 4. Database Migration
Current state uses in-memory Maps for sessions/rate limits.
Production should use:
- Redis or PostgreSQL for sessions
- Upstash for rate limiting

Example migration:
```javascript
// api/login.js - Replace Map with database
const db = require('your-db-client');

// Save session
await db.sessions.create({
  token: sessionToken,
  user,
  expiresAt: new Date(Date.now() + 86400000)
});

// Check session in middleware
const session = await db.sessions.findOne({ token: sessionToken });
if (!session || session.expiresAt < new Date()) {
  return NextResponse.redirect('/login.html');
}
```

## Security Checklist

- [ ] Change `BETA_PASS` from default
- [ ] Enable Vercel HTTPS (automatic)
- [ ] Configure CORS properly for production domain
- [ ] Set secure cookie flags (already done in login.js)
- [ ] Enable Vercel Firewall & DDoS protection
- [ ] Regular dependency updates: `npm audit fix`
- [ ] Monitor Vercel Analytics for suspicious activity

## Monitoring & Alerts

### Vercel Monitoring
1. Set up notifications for failed deployments
2. Monitor function execution times
3. Track API error rates

### External Monitoring (Optional)
- Add Sentry for error tracking
- Add Datadog for performance monitoring
- Set up email alerts for critical errors

## Rollback Procedure

If deployment has issues:
1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "Redeploy" button
4. Verify services restored
5. Investigate issue in local environment

## Update Procedure

To deploy new code:
```bash
# 1. Make changes locally
git add .
git commit -m "Description of changes"
git push origin main

# 2. Vercel auto-deploys (if GitHub connected)
# 3. Monitor deployment in Vercel Dashboard
# 4. Check deployment preview URL
# 5. Merge to production when ready
```

For hotfixes:
```bash
# Create hotfix branch
git checkout -b hotfix/issue-name
# Make changes
git commit -m "Hotfix: description"
git push origin hotfix/issue-name

# Verify in preview
# Merge to main when ready
git checkout main
git merge hotfix/issue-name
git push origin main
```

---

**Last Updated**: March 2026
**Version**: 2.0.0
**Contact**: contact@topo3d-antilles.com
