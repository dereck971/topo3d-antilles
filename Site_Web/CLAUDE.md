# Topo3D Antilles

## Projet
SaaS de modelisation topographique 3D et diagnostic reglementaire pour parcelles cadastrales.
Couvre Guadeloupe (971), Martinique (972), toute la France via APIs IGN.

**URL production** : https://topo3d-antilles.com (alias www.topo3d-antilles.com)
**Version** : 2.0.0 (v7.0.0 restore)

## Pricing
- Fiche Parcelle Reglementaire : 19 EUR
- Essentiel (export OBJ) : 59 EUR
- Complet (OBJ + DXF + GeoJSON) : 129 EUR
- Premium (tous exports + maquette blanche) : 249 EUR
- Pro mensuel : 349 EUR/mois
- Pro annuel : 2 990 EUR/an

## Stack
- HTML5 + CSS + JS vanilla
- MapLibre GL (carte interactive vectorielle)
- Three.js (rendu 3D, bundle local 603 KB)
- Vercel Serverless Functions (Node.js, maxDuration 60s)
- pdf-lib (generation PDF fiche parcelle)
- Resend (emails transactionnels)
- Stripe (checkout + webhook)

## Structure

```
index.html                    — Landing page
carte.html                    — Carte interactive (produit principal)
carte.js / carte.min.js       — Logique carte (81.7 KB / 56.5 KB)
fiche-produit-maquette.html   — Page produit maquette 3D
comment-ca-marche.html        — Guide utilisateur
login.html                    — Authentification beta
cgv.html                      — Conditions generales
confidentialite.html          — Politique RGPD
references.html               — Mentions legales
success.html                  — Confirmation post-achat
css/
  design-system.css           — Variables + base
  index.css                   — Styles landing
  carte.css                   — Styles carte
  pages.css                   — Styles secondaires
assets/
  three.min.js                — Three.js bundle local
  *.webp, *.jpg               — Visuels produit
  terrain-trois-rivieres.obj  — Modele 3D demo
api/
  fiche-parcelle.js           — Generation PDF fiche reglementaire
  compute-runoff.js           — Calculs hydrologiques
  elevation.js                — Donnees altitude MNT
  contours.js                 — Courbes de niveau
  generate-dxf.js             — Export DXF
  generate-obj.js             — Export OBJ 3D
  generate-geojson.js         — Export GeoJSON
  login.js                    — Authentification session
  logout.js                   — Deconnexion
  email.js                    — Envoi emails Resend
  webhook.js                  — Webhooks Stripe
middleware.js                 — Middleware requetes
```

## Variables d'environnement requises (Vercel)
```
BETA_USER
BETA_PASS
SESSION_SECRET
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
```

## APIs externes
- `apicarto.ign.fr` — Parcelles cadastrales
- `data.geopf.fr/altimetrie` — MNT elevation
- `api-adresse.data.gouv.fr` — Geocodage adresses
- `georisques.gouv.fr` — Risques naturels (PPRN, PPRI)
- `inpn.mnhn.fr` — Natura 2000, ZNIEFF
- `data.culture.gouv.fr` — Monuments historiques
- `openfreemap.org` — Tuiles vectorielles carte

## Regles
- JAMAIS de credentials dans le code
- JAMAIS de CORS wildcard (*)
- Three.js DOIT rester en bundle local (CSP interdit CDN eval)
- carte.js est le fichier critique — toujours tester apres modification
- Le middleware.js gere l'auth — pages publiques vs protegees
- Les exports (OBJ/DXF/GeoJSON) sont verrouilles derriere Stripe
- 7 couches reglementaires PRO verrouillees (PLU, Natura 2000, ZNIEFF, Littoral, MH, PPR, prescriptions)

## Dev local
```bash
npx vercel dev --listen 3000
# Credentials beta : voir .env (BETA_USER / BETA_PASS)
```

## Deploy
```bash
vercel --prod
```

## URL rewrites (vercel.json)
- /carte -> carte.html
- /comment-ca-marche -> comment-ca-marche.html
- /references -> references.html
- /cgv -> cgv.html
- /confidentialite -> confidentialite.html
- /produit -> fiche-produit-maquette.html
- /success -> success.html
