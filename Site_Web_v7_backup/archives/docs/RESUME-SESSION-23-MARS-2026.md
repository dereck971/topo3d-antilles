# RESUME SESSION — 23 mars 2026
## Topo3D-Antilles : Versioning, Restauration, Deploiement

---

## ETAT ACTUEL DU SITE

**URL live** : https://topo3d-antilles.vercel.app
**Version deployee** : V7.0 (deploiement du 23 mars via `npx vercel --prod`)
**Compte Vercel** : dereckrauzduel-7264s-projects / projet topo3d-antilles
**Domaine custom** : topo3d-antilles.com (DNS NON CONFIGURE — voir section DNS)

---

## HISTORIQUE DES VERSIONS (7 versions identifiees)

| Version | Date | Fichier source | Description |
|---------|------|----------------|-------------|
| V1.0 | ~15 mars | `landing-topo3d.html` | Proto landing dark, Inter, "Topo3D Guadeloupe", email orders via immoservices971.com |
| V2.0 | ~16 mars | `topo3d-app.html` | Proto app carte interactive, sidebar, tabs, layers, camera 3D |
| V3.0 | ~17 mars | `fiche-produit-maquette.html` | Page produit "Maquette Topographique 3D", previews 3D |
| V4.0 | ~18 mars | 3 variantes | Design variants : Karukera Gold, Terre-Mer, Volcanic Tech |
| V5.0 | 20 mars | SOURCE PERDUE | Full rewrite, plan topo interactif, multi-styles, page produit integree |
| V6.0 | 21 mars | `index.html` (actuel) | Reconstruction 20 fichiers. Page produit perdue. Carte noire. |
| V7.0 | 23 mars | index.html modifie | V6 + page produit restauree + fixes carte + VERSION.json |

### PROBLEME CRITIQUE : Le code source de la V5 a ete ecrase par la V6

La V5 etait la "bonne version" avec :
- Plan topographique interactif avec courbes de niveau en SVG
- 3 styles de rendu (Impression, Classique, Topographique)
- Export PNG / SVG / PDF A4
- Page produit integree
- Screenshots conserves dans `screenshots/topo-v5-*.png`

La V6 (reconstruction) est un site COMPLETEMENT DIFFERENT (pas une evolution de V5).

---

## FICHIERS DANS Site_Web/

### Pages HTML actives (V7 deployee)
- `index.html` — Landing page (light theme, DM Sans, pricing 29/69/149/199)
- `login.html` — Auth page (glassmorphism, dark)
- `carte.html` — Carte MapLibre 2D (14 layers, tabs Guadeloupe/Martinique)
- `comment-ca-marche.html` — Guide 8 sections
- `references.html` — Mentions legales, RGPD
- `cgv.html` — Conditions generales
- `confidentialite.html` — Politique confidentialite
- `success.html` — Page succes
- `fiche-produit-maquette.html` — Page produit (restauree en V7, route /produit)

### Pages HTML orphelines (pas dans la nav, pas deployees activement)
- `landing-topo3d.html` — V1 landing dark
- `topo3d-app.html` — V2 app carte avec sidebar
- `hero-3d.html` — Animation hero 3D
- `preview-maquette-3d.html` — Preview 3D (route /preview-3d ajoutee en V7)
- `preview-terrain-brut.html` — Preview terrain brut

### API serverless (9 endpoints dans /api/)
- `login.js` — Auth (BETA_USER/BETA_PASS, rate limit, cookie httpOnly)
- `elevation.js` — IGN MNT
- `contours.js` — API Cadastre
- `generate-obj.js` — Export OBJ
- `generate-dxf.js` — Export DXF
- `generate-geojson.js` — Export GeoJSON
- `fiche-parcelle.js` — PDF reglementaire (pdf-lib)
- `email.js` — Resend API
- `webhook.js` — Stripe webhook

### Config
- `vercel.json` — Rewrites, CSP, headers, cache
- `middleware.js` — Auth middleware (routes publiques/protegees)
- `package.json` — Dependencies (pdf-lib, resend)
- `.env` — Variables locales
- `.gitignore` — Exclusions
- `VERSION.json` — Historique des 7 versions

### Assets
- `assets/rendu-maquette-blanche.webp/.jpg`
- `assets/rendu-photorealiste.webp/.jpg`
- `assets/rendu-photorealiste-sans-volcan.webp/.jpg`
- `assets/topo-trois-rivieres-3d.webp/.jpg`
- `assets/topo-trois-rivieres-couleur.webp/.jpg`
- `hero-topo3d.webp`
- `preview-karukera.jpg` (V4 variante)
- `preview-terre-mer.jpg` (V4 variante)
- `preview-volcanic.jpg` (V4 variante)
- `screenshots/topo-v5-print.png`
- `screenshots/topo-v5-classic.png`
- `screenshots/topo-v5-topo.png`

### Archives (creees cette session)
- `archives/topo3d-v1-landing-dark.html` (copie de landing-topo3d.html)
- `archives/topo3d-v3-page-produit.html` (copie de fiche-produit-maquette.html)
- `versions-compare.html` — Page comparative visuelle V4/V5/V6

---

## CORRECTIONS FAITES CETTE SESSION

### Deploiement V7 (23 mars)
1. **Page produit restauree** — `/produit` → `fiche-produit-maquette.html` (rewrite vercel.json)
2. **Nav corrigee** — Lien "Produit" pointe vers `/produit` (avant: `#features`)
3. **Images corrigees** — `.png` inexistants → `.webp` existants dans assets/
4. **Navigation ajoutee** dans fiche-produit-maquette.html (logo + liens)
5. **Footer enrichi** — Liens "Apercu Produit" ajoutes
6. **VERSION.json cree** — Historique complet des 7 versions
7. **Rewrites ajoutes** — `/produit`, `/preview-3d`, `/success`
8. **Cache** — fiche-produit-maquette.html ajoute au pattern de cache

### Corrections session precedente (incluses dans V7)
9. **Tile URL carte** — `openfreemap.org/data/planet` (403) → `openfreemap.org/planet`
10. **Glyphs MapLibre** — Ajout `demotiles.maplibre.org/font/`
11. **CSP** — Ajout `demotiles.maplibre.org` dans connect-src, style-src, font-src, img-src
12. **api/email.js** — Fix attachments conditionnel
13. **api/webhook.js** — From `noreply@` → `support@`
14. **api/fiche-parcelle.js** — Fix checkPageBreak() return value

---

## VARIABLES D'ENVIRONNEMENT (configurees sur Vercel)

```
BETA_USER=beta
BETA_PASS=topo3d2026
SESSION_SECRET=7ce8e1c6b92d3f9976828773514551fa7b4e980f253a353cc15b108a8fa33808
STRIPE_WEBHOOK_SECRET=whsec_9F6UJr6zoHW3YXEajL4jRaLnE6dAx6Sc
RESEND_API_KEY=re_MxEaCBFX_6wVM65NHdDc1gcJCpAMDs8Sx
```

---

## PROBLEMES NON RESOLUS

### 1. DNS topo3d-antilles.com
- Le domaine ne resout PAS (erreur Safari "can't find server")
- Il faut configurer un A record `@ → 76.76.21.21` chez le registrar
- Le registrar n'a PAS ete identifie — chercher dans les emails (OVH? Namecheap? GoDaddy? Vercel Domains?)
- En attendant, le site est accessible sur `topo3d-antilles.vercel.app`

### 2. Page produit "n'est plus la meme"
- Le user dit que la page produit actuelle ne correspond pas a celle qu'il connaissait
- A clarifier : quelle version de la page produit est la bonne ?
- La section "Rendu Maquette" a un placeholder texte au lieu d'une vraie image
- Les images referent les fichiers dans assets/ (rendu-maquette-blanche.webp, etc.)

### 3. V5 perdue — features manquantes
- Plan topographique interactif (courbes de niveau SVG) = PAS dans V6/V7
- Multi-styles (Impression, Classique, Topographique) = PAS dans V6/V7
- Export PNG/SVG/PDF A4 du plan topo = PAS dans V6/V7
- Ces features existaient dans la V5 mais le code source a ete ecrase
- Option : recuperer depuis un ancien deploiement Vercel ou réécrire

### 4. Nomenclature fichiers
- Le user veut "plus de rigueur" dans les noms de fichiers
- Les fichiers orphelins ont des noms non-versionnes (landing-topo3d.html, topo3d-app.html)
- Archives partiellement creees : V1 et V3 copies dans archives/, V2 et V6 echoues
- TODO : finir le renommage/archivage propre

### 5. Fichier V1-landing-dark-proto.html
- Un stub vide a ete cree par erreur a la racine de Site_Web — A SUPPRIMER

---

## PROCHAINES ETAPES (par priorite)

1. **Trouver le registrar DNS** — Chercher dans Gmail (receipt de domaine, confirmation d'achat)
2. **Clarifier la "bonne" page produit** — Le user doit dire exactement ce qui manque/differe
3. **Decider du sort de la V5** — Réécrire les features manquantes OU les considerer comme futures
4. **Finir l'archivage** — Copier topo3d-app.html → archives/topo3d-v2-app-carte.html, index.html → archives/topo3d-v6-reconstruction.html
5. **Nettoyer** — Supprimer le stub V1-landing-dark-proto.html, le versions-compare.html si plus utile
6. **Git** — Initialiser un repo git dans Site_Web pour ne plus JAMAIS perdre de version

---

## COMMANDES UTILES

```bash
# Deployer sur Vercel
cd ~/Desktop/SYNTHESE\ ECOSYSTEME/02_Topo3D/Site_Web
npx vercel --prod

# Verifier git
git log --oneline
git status

# Initialiser git (si pas fait)
git init
git add -A
git commit -m "V7.0 - Restoration page produit + fixes"
```

---

## ACCES VERCEL

- Dashboard : https://vercel.com/dereckrauzduel-7264s-projects/topo3d-antilles
- Settings : https://vercel.com/dereckrauzduel-7264s-projects/topo3d-antilles/settings
- Deployments : https://vercel.com/dereckrauzduel-7264s-projects/topo3d-antilles/deployments
- Env vars : Settings > Environment Variables (5 vars configurees)
- Deployment Protection : Standard Protection (previews only, prod accessible)

---

*Resume genere le 23 mars 2026*
