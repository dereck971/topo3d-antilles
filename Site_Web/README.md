# Topo3D-Antilles 🏔️ - Vercel SaaS Project

Complete reconstruction of Topo3D-Antilles, a modern SaaS platform for 3D LiDAR topography data in the Caribbean (Guadeloupe, Martinique, and dependencies).

## Quick Overview

**Type**: Vercel serverless + static site  
**Tech Stack**: HTML5, CSS3, JavaScript (IIFE), MapLibre GL, Node.js  
**Design**: Light theme landing page, dark theme app  
**Status**: Beta Pro (Bêta Pro)

## Project Structure

```
/topo3d-deploy/
├── index.html              # Landing page (light theme, public)
├── login.html              # Authentication page
├── carte.html              # Interactive map (2000+ lines, core product)
├── comment-ca-marche.html  # How-it-works guide
├── references.html         # Legal notices & data sources
├── middleware.js           # Vercel Edge authentication
├── package.json            # Dependencies & metadata
├── vercel.json             # Serverless configuration
├── api/
│   ├── login.js           # Authentication endpoint
│   ├── elevation.js       # IGN elevation data
│   ├── contours.js        # Cadastral parcelles
│   ├── generate-obj.js    # OBJ 3D mesh export
│   ├── generate-dxf.js    # DXF CAD export
│   ├── generate-geojson.js # GeoJSON export
│   ├── fiche-parcelle.js  # PDF regulatory report
│   ├── email.js           # Resend email service
│   └── webhook.js         # Stripe payment webhook
├── PROJECT_STRUCTURE.md   # Detailed architecture
├── DEPLOYMENT_CHECKLIST.md # Setup & deployment guide
└── README.md              # This file
```

## Key Files Overview

### Frontend Pages

**index.html** - Full landing page with:
- Navigation bar with DM Sans font
- Hero section (background image: hero-topo3d.webp)
- Stats bar (±0.2m precision, 66 communes, <24h, 4+ formats)
- Avant/Après comparison (surveyor vs Topo3D)
- 3-step "how it works" section
- 7 features highlight
- 4-tier pricing (29€–199€/mth)
- Trust section (IGN, Stripe, Etalab 2.0)
- FAQ accordion with 7 questions
- Footer with contact info

**login.html** - Glassmorphism authentication card with:
- Dark theme (#0a0a14 background)
- Particle animation
- Background image (hero-topo3d.webp)
- Form validation & error messages
- Loading state with animated dots
- Auto-redirect to /carte on success

**carte.html** - Interactive map application (core product):
- MapLibre GL JS integration (v4.1.2 CDN)
- Dark theme interface (#0a0a14)
- Tab selector: Guadeloupe / Martinique (lat/lon switching)
- Side panel with:
  - Selected parcel info (commune, section, number, surface, address)
  - 7 base layers: Cadastre, Buildings 3D, Orthophoto, Hillshade, Contours, Hydro, Risks
  - 7 regulatory layers (Pro tier): PLU, Natura 2000, ZNIEFF, Littoral, Monuments, PPR
- Export panel with:
  - 4 pricing tiers with format descriptions
  - Export & Fiche Parcelle buttons
- Loading overlay with Antillean-themed messages
- Logout button in header

**comment-ca-marche.html** - Detailed guide covering:
- 8 sections: Selection, Export, Generation, Layers, Fiche Parcelle, Formats, Security, Support
- Step cards with numbered sections
- Format explanations (OBJ, DXF, IFC, GeoJSON, PDF)
- Regulatory data layer descriptions

**references.html** - Legal & data sources page:
- GDPR compliance section
- Data source attribution (IGN, API Cadastre, Géorisques, INPN, etc.)
- Security & payment info (Stripe PCI-DSS)
- Copyright & liability
- Partner links (Karukera Conseil, Vercel, MapLibre)

### Configuration Files

**middleware.js** - Vercel Edge Middleware:
- PUBLIC routes: /, /index.html, /login.html, /api/login, static assets
- PROTECTED routes: /carte.html, /api/contours, /api/elevation, /api/generate-*, /api/fiche-parcelle, /api/email
- Session verification: `topo3d_session` cookie check
- Redirects to /login.html if not authenticated

**vercel.json** - Serverless configuration:
- Function timeout: 30 seconds, memory: 1024MB
- URL rewrites: /carte → /carte.html, /comment-ca-marche → /comment-ca-marche.html
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Cache control: 1 year for static assets

**package.json** - Dependencies:
- `pdf-lib`: PDF generation for fiche parcelle
- `resend`: Email delivery service

### API Endpoints (Serverless Functions)

**POST /api/login**
- Validates credentials (BETA_USER, BETA_PASS env vars)
- Rate limiting: 5 attempts/minute per IP
- Sets httpOnly session cookie (24h expiry)
- Returns: `{ok: true}` or `{error: "Invalid credentials"}`

**GET /api/elevation?lat=X&lon=Y**
- Fetches elevation from IGN MNT API
- 10s timeout via AbortController
- Returns: `{elevation, lat, lon, resolution, source}`

**GET /api/contours?lat=X&lon=Y**
- Calls apicarto.ign.fr for cadastral parcelles
- Returns GeoJSON feature with properties (commune, section, numero, surface, address)

**POST /api/generate-obj**
- Generates Wavefront OBJ 3D mesh
- Input: `{geometry, elevation, resolution}`
- Output: OBJ file (text/plain) with triangulated surface

**POST /api/generate-dxf**
- Generates AutoCAD DXF R12 format
- Input: `{geometry, contours}`
- Output: DXF file with parcel boundary + contour layers

**POST /api/generate-geojson**
- Generates GeoJSON FeatureCollection
- Calculates area, bounding box, elevation stats
- Returns enriched GeoJSON with metadata

**POST /api/fiche-parcelle**
- Generates branded PDF report (15€ option)
- Fetches 5 regulatory datasets in parallel:
  - IGN MNT (elevation)
  - Géorisques (natural risks)
  - INPN Natura 2000
  - INPN ZNIEFF
  - Culture.gouv.fr Monuments historiques
- PDF sections: Localisation, Élévation, Risques, Zones protégées
- Returns PDF (application/pdf attachment)

**POST /api/email**
- Sends transactional emails via Resend API
- Input: `{to, subject, htmlContent, textContent}`
- From: commandes@topo3d-antilles.com
- Returns: `{ok: true, messageId}`

**POST /api/webhook**
- Stripe webhook endpoint for `checkout.session.completed`
- Verifies signature with STRIPE_WEBHOOK_SECRET
- Triggers confirmation email to customer

## Design System

**Colors**
- Primary accent: `#00c896` (bright green) / `#00D4AA` (light variant)
- Dark theme: `#0a0a14` (near black)
- Light theme: `#fafafa` (off white)
- Text: `#222` (light theme), `#ccc` (dark theme)

**Font**
- DM Sans (Google Fonts CDN)
- Weights: 400, 500, 600, 700

**Brand**
- Name: Topo3D-Antilles 🏔️
- Tag: Bêta Pro
- Logo: Mountain emoji 🏔️

**Themes**
- Landing & legal pages: Light (#fafafa background)
- Login & map: Dark (#0a0a14 background)
- Accessibility: `prefers-reduced-motion` support

## Features

✅ **Authentication**: Session-based with httpOnly cookies  
✅ **Interactive Map**: MapLibre GL with layer system  
✅ **Multi-format Export**: OBJ, DXF, GeoJSON, PDF, IFC, DWG, SHP, STL, KML  
✅ **Regulatory Data**: 7 layers (PLU, Natura 2000, ZNIEFF, PPR, etc.)  
✅ **PDF Generation**: Branded fiche parcelle with external API data  
✅ **Stripe Payment**: Webhook integration for checkout  
✅ **Email Service**: Resend API for transactional emails  
✅ **Rate Limiting**: 5 attempts/minute per IP  
✅ **CORS Headers**: Security headers for all endpoints  
✅ **Beta Mode**: Cookie-based beta bypass (no payment required)  

## Environment Variables

Required in Vercel project settings:

```bash
BETA_USER=admin              # Username for authentication
BETA_PASS=<YOUR_SECURE_PASSWORD>  # REQUIRED: Set a strong password
RESEND_API_KEY=re_xxxxx      # From https://resend.com
STRIPE_WEBHOOK_SECRET=whsec_ # From Stripe Dashboard
```

## Data Sources

- **IGN LiDAR HD**: Elevation data (±0.2m, 2m maille)
- **API Cadastre**: Cadastral parcelles
- **Géorisques**: Natural risks/hazards
- **INPN**: Natura 2000, ZNIEFF protected areas
- **Géoportail France**: Orthophoto, maps
- **Culture.gouv.fr**: Historic monuments

All data under **Etalab 2.0 license** (open, commercial use allowed with attribution).

## Deployment

See **DEPLOYMENT_CHECKLIST.md** for complete setup instructions.

Quick start:
```bash
# 1. Set environment variables in Vercel
# 2. Connect GitHub repo to Vercel (automatic deployments)
# 3. Test: https://your-domain.com/login.html
# 4. Verify routes and API endpoints
# 5. Configure Stripe webhook URL
# 6. Set Resend API key for email
```

## Static Assets Required

These files must be added to project root:
- `hero-topo3d.webp` - Hero background image (used by multiple pages)

Fonts are loaded from Google Fonts CDN (no local files needed).

## File Statistics

- **Total files**: 19 (HTML, JS, JSON, markdown)
- **HTML pages**: 5
- **API endpoints**: 9
- **Total size**: ~184KB
- **Lines of code**: 2000+ in carte.html alone

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

**Code**: © 2026 Topo3D-Antilles. All rights reserved.  
**Data**: Etalab 2.0 (open license, commercial use allowed with attribution)

## Contact

- **General**: contact@topo3d-antilles.com
- **Support**: support@topo3d-antilles.com
- **Partner**: Karukera Conseil (karukera-conseil.com)

## Version History

- **2.0.0** (2026-03-21): Complete reconstruction with fixed middleware & full feature set
- **1.0.0** (2026-01-XX): Initial launch

---

**Generated**: March 2026  
**Status**: Production-ready  
**Last Updated**: 2026-03-21
