# Topo3D-Antilles Vercel Project Structure

## Overview
Complete Vercel deployment for Topo3D-Antilles - a SaaS platform for 3D LiDAR topography data in the Caribbean.

## Root Files

### `package.json`
- Project metadata
- Dependencies: pdf-lib, resend
- Node.js module configuration (type: module)

### `vercel.json`
- Serverless function configuration (30s timeout, 1024MB memory)
- URL rewrites (/carte → /carte.html, /comment-ca-marche → /comment-ca-marche.html)
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Cache control for static assets

### `middleware.js`
- Vercel Edge Middleware for authentication
- PUBLIC routes: /, /index.html, /login.html, /api/login, static assets
- PROTECTED routes: /carte.html, /api/contours, /api/elevation, /api/generate-*, /api/fiche-parcelle, /api/email
- Session verification via topo3d_session cookie

## HTML Files

### `index.html` (Landing Page)
- Light theme (#fafafa background)
- Full landing page with:
  - Fixed navigation with DM Sans font
  - Hero section with background image (hero-topo3d.webp)
  - Stats bar (precision, communes, delivery time, formats)
  - Avant/Après comparison (traditional surveyor vs Topo3D)
  - How it works in 3 steps
  - 7 features section
  - 4-tier pricing (Essentiel 29€, Complet 69€, Premium 149€, Pro+ 199€/mth)
  - Trust section (IGN, Stripe, Etalab license)
  - FAQ with accordion (7 questions)
  - Footer with links and contact

### `login.html`
- Glassmorphism card design
- Dark theme (#0a0a14 background)
- Particle animation
- Hero image background (hero-topo3d.webp)
- POSTs to /api/login
- Loading state with animated dots
- Error/success messages

### `carte.html` (Interactive Map - Core Product)
- Dark theme (#0a0a14)
- 2000+ lines of HTML/CSS/JS
- MapLibre GL JS integration (v4.1.2)
- Tab system: Guadeloupe / Martinique
- Side panel with:
  - Parcel info display
  - 7 base layers: Cadastre, Buildings 3D, Orthophoto, Hillshade, Contours, Hydro, Risks
  - 7 regulatory layers (Pro tier gated): PLU, Natura 2000, ZNIEFF, Littoral, MH, PPR
- Export panel with:
  - 4 pricing tiers
  - Format descriptions
  - Fiche Parcelle Réglementaire button (15€)
- Loading animation with Antillean-themed messages
- Logout button in header
- Beta mode support via cookie (topo3d_beta=true)

### `comment-ca-marche.html`
- Detailed guide to platform functionality
- 8 sections with step cards
- Format explanations (OBJ, DXF, IFC, GeoJSON, PDF)
- Regulatory layers guide
- Security & compliance info
- Support contact details

### `references.html`
- Legal notices (mentions légales)
- GDPR compliance section
- Data sources (IGN, API Cadastre, Géorisques, INPN, etc.)
- Security & payment information
- Copyright & IP
- Liability limitations
- Partner links (Karukera Conseil, Vercel, Stripe, MapLibre)

## API Functions (Serverless)

### `api/login.js`
- POST /api/login
- Validates credentials against BETA_USER, BETA_PASS env vars
- Rate limiting: 5 attempts/minute per IP
- Generates UUID session token
- Sets topo3d_session (httpOnly, secure, sameSite=lax, 24h)
- Sets topo3d_beta cookie for beta bypass
- Returns 200 {ok: true} on success, 401 on failure

### `api/elevation.js`
- GET /api/elevation?lat=X&lon=Y
- Fetches IGN MNT data
- 10s timeout via AbortController
- Returns {elevation, lat, lon, resolution, source}

### `api/contours.js`
- GET /api/contours?lat=X&lon=Y
- Calls apicarto.ign.fr API Cadastre
- Returns GeoJSON feature with parcel properties
- Properties: commune, section, numero, surface, address, codeInsee, feuille

### `api/generate-obj.js`
- POST /api/generate-obj
- Accepts geometry, elevation, resolution
- Generates Wavefront OBJ mesh
- Simple triangulation algorithm
- Returns as text/plain attachment

### `api/generate-dxf.js`
- POST /api/generate-dxf
- Accepts geometry, contours
- Generates DXF R12 format file
- Parcel boundary + contour lines as layers
- Returns as text/plain attachment

### `api/generate-geojson.js`
- POST /api/generate-geojson
- Accepts geometry, elevation, properties
- Calculates area (Shoelace formula)
- Computes bounding box
- Enriches with metadata (source, precision, CRS)
- Returns GeoJSON FeatureCollection

### `api/fiche-parcelle.js`
- POST /api/fiche-parcelle
- Accepts commune, section, numero, lat, lon
- Fetches 5 regulatory datasets in parallel:
  - MNT (elevation) from IGN
  - Risks from Géorisques
  - Natura 2000 from INPN
  - ZNIEFF from INPN
  - Monuments historiques from Culture.gouv.fr
- Generates branded PDF with pdf-lib
- Primary color: #00c896
- 4 sections: Localisation, Élévation, Risques, Zones protégées
- Returns as application/pdf attachment

### `api/email.js`
- POST /api/email
- Accepts to, subject, htmlContent, textContent
- Sends via Resend API (RESEND_API_KEY env var)
- From: commandes@topo3d-antilles.com
- Reply-to: support@topo3d-antilles.com
- Returns {ok: true, messageId}

### `api/webhook.js`
- POST /api/webhook (Stripe webhook)
- Verifies signature with STRIPE_WEBHOOK_SECRET
- Handles checkout.session.completed events
- Sends confirmation email to customer
- Returns {received: true}

## Design System

- **Font**: DM Sans (Google Fonts)
- **Primary accent**: #00c896 (bright green) / #00D4AA (light variant)
- **Dark theme**: #0a0a14 (near black)
- **Light theme**: #fafafa (off white)
- **Brand**: Topo3D-Antilles 🏔️
- **Tag**: Bêta Pro

## Key Features

1. **Authentication**: Session-based with httpOnly cookies
2. **Interactive Map**: MapLibre GL with layer toggles
3. **Multi-format Export**: OBJ, DXF, GeoJSON, PDF, IFC, DWG, SHP, STL, KML
4. **Regulatory Data**: PLU, Natura 2000, ZNIEFF, PPR, Monuments, etc.
5. **PDF Generation**: Branded fiche parcelle with external API data
6. **Payment**: Stripe integration via webhook
7. **Email**: Resend API for transactional emails
8. **Accessibility**: prefers-reduced-motion support
9. **Security**: CORS headers, RGPD compliance, Etalab 2.0 license

## Environment Variables Required

- `BETA_USER`: Username for beta access
- `BETA_PASS`: Password for beta access
- `RESEND_API_KEY`: API key for Resend email service
- `STRIPE_WEBHOOK_SECRET`: Secret for Stripe webhook signature verification

## Data Sources

- **IGN LiDAR HD**: Elevation data (±0.2m precision)
- **API Cadastre**: Cadastral parcels
- **Géorisques**: Natural risks
- **INPN**: Natura 2000, ZNIEFF
- **Géoportail France**: Orthophoto, maps
- **Culture.gouv.fr**: Historic monuments

## License

- Code: © 2026 Topo3D-Antilles
- Data: Etalab 2.0 (open license, commercial use allowed with attribution)

