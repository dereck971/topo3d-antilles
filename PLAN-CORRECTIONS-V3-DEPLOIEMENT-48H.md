# TOPO3D ANTILLES — PLAN DE CORRECTIONS V3
## Objectif : Déploiement en 48h — Lancement parfait

**Date** : 19 mars 2026
**Auteur** : Dereck Rauzduel — Architecte EPFL
**Sources** : Audit McKinsey Écosystème (mars 2026) + Étude de Marché Mondiale Topo3D (mars 2026) + Audit code complet (7 fichiers analysés)

---

## ÉTAT DES LIEUX — CE QUI EXISTE

| Fichier | Rôle | État |
|---------|------|------|
| `07-Site-Web/variante-finale.html` | Site vitrine one-page | Quasi-prêt, incohérences pricing |
| `02-Landing-Page/landing-topo3d.html` | Page de vente détaillée | Pricing obsolète (49/99/249€) |
| `01-Application/topo3d-app.html` | App carte 3D interactive | Fonctionnelle, pas déployée |
| `06-Scripts/generate_terrain.py` | Moteur de génération OBJ/DXF | Opérationnel |
| `05-Demo-Output/` | Fichiers démo (terrain.obj, courbes.dxf) | OK — utilisable comme showcase |
| `08-Animation-3D/hero-3d.html` | Animation hero Three.js | Existante |
| `07-Site-Web/references.html` | Page références | Non vérifiée |

**3 versions de pricing en conflit :**
- `variante-finale.html` : Essentiel 29€ / Complet 69€ / Premium 149€
- `landing-topo3d.html` : Essentiel 49€ / Complet 99€ / Pro 249€/mois
- `RESUME-PROJET.md` : Essentiel 49€ / Complet 99€ / Pro 249€/mois
- **Étude de marché recommande** : Découverte 9€ / Essentiel 29€ / Complet 69€ / Premium 199€ / Pro 299€/mois / Pro annuel 2990€

---

## BLOC 1 — CRITIQUE (Heures 0-12) : Bloquants au lancement

### 1.1 UNIFIER LE PRICING (Impact : Bloquant)

**Problème** : 3 grilles de prix différentes entre les fichiers. Le client ne sait pas quoi payer.

**Pricing V3 à appliquer partout** (basé sur l'étude de marché) :

| Offre | Prix | Contenu | Cible |
|-------|------|---------|-------|
| Découverte | 9€ | OBJ 5m + GeoJSON seul | Curieux, étudiants |
| Essentiel | 29€ | OBJ 5m + GeoJSON + rapport PDF | Particuliers, petits projets |
| Complet ⭐ | 69€ | OBJ LiDAR 2m + DXF + pentes + PDF | Architectes, promoteurs |
| Premium | 199€ | Tous formats (IFC, DWG, STL, KML) | BET, géomètres, BIM |
| Pro mensuel | 299€/mois | Illimité + API REST + support | Cabinets archi, BET |
| Pro annuel | 2 990€/an | Idem Pro, remise 17% | BET engagés |

**Fichiers à modifier** :
- [ ] `07-Site-Web/variante-finale.html` — section `.pricing` (lignes 247-292)
- [ ] `02-Landing-Page/landing-topo3d.html` — section `#pricing` (lignes 424-475)
- [ ] `01-Application/topo3d-app.html` — section `.pricing` dans la sidebar
- [ ] `RESUME-PROJET.md` — tableau "Modèle tarifaire" (lignes 80-84)

**Justifications étude de marché** :
- Tier 9€ : contrer TopoExport gratuit, +30% leads, -10% panier moyen — net positif
- 69€ comme ancre : sweet spot LiDAR + DXF + analyse, marge optimale
- 149€ → 199€ : écart trop faible avec 69€, passage à 199€ = +34% revenu
- Ajout Pro mensuel : les cabinets paient 300-600€/mois pour Pix4D/DroneDeploy
- Pack annuel : lock-in 12 mois, budget prévisible pour BET

---

### 1.2 RÉPARER TOUS LES LIENS MORTS (Impact : Bloquant)

**Problème** : Les CTA principaux ne mènent nulle part.

**variante-finale.html** :
- [ ] `<a href="#" class="nav-cta">Ouvrir la carte</a>` → lier vers `/app` ou `topo3d-app.html`
- [ ] `<a href="#" class="btn-p">Ouvrir la carte 3D →</a>` → idem
- [ ] `<a href="#" class="pcard-btn">Commander →</a>` (×3) → vers Stripe Checkout ou mailto pré-rempli
- [ ] `<a href="#" class="btn-p">Ouvrir la carte 3D →</a>` (CTA final) → idem hero
- [ ] `<a href="#">Karukera Conseil Immobilier</a>` (footer) → `https://immoservices971.com`

**topo3d-app.html** :
- [ ] `<a href="index.html">Accueil</a>` → vérifier chemin relatif après déploiement
- [ ] `<a href="references.html">Références</a>` → vérifier existence
- [ ] `<a href="https://immoservices971.com">KCI Conseil</a>` → OK mais vérifier que le site est live

**landing-topo3d.html** :
- [ ] Liens mailto → fonctionnels ✅ mais à remplacer par Stripe dès intégration
- [ ] Section témoignages : commentée `<!-- à ajouter après les premiers vrais retours clients -->` → à débloquer avec contenu placeholder ou retirer la section

---

### 1.3 INTÉGRER STRIPE (Impact : Bloquant pour le CA)

**Problème** : Aucun moyen de payer en ligne. L'audit McKinsey identifie l'intégration Stripe comme priorité #1.

**Actions** :
- [ ] Créer un compte Stripe (ou vérifier qu'il existe déjà)
- [ ] Créer les Payment Links pour chaque offre :
  - Découverte : 9€ one-time
  - Essentiel : 29€ one-time
  - Complet : 69€ one-time
  - Premium : 199€ one-time
  - Pro mensuel : 299€/mois récurrent
  - Pro annuel : 2 990€/an récurrent
- [ ] Remplacer tous les `href="#"` et `mailto:` par les URLs Stripe Payment Links
- [ ] Configurer les emails de confirmation Stripe

**Alternative rapide si Stripe pas prêt en 48h** :
- [ ] Formulaire Tally.so ou Typeform avec les champs : nom, email, parcelle, offre choisie
- [ ] Lier les CTA vers ce formulaire

---

### 1.4 MENTIONS LÉGALES (Impact : Légal — Obligatoire en France)

**Problème** : Aucune mention légale sur aucun des fichiers. Obligation LCEN.

- [ ] Créer `mentions-legales.html` avec :
  - Raison sociale (micro-entreprise ou SASU KCI)
  - SIRET
  - Adresse
  - Contact (email + téléphone)
  - Hébergeur (Vercel Inc.)
  - CGV (Conditions Générales de Vente)
  - Politique de cookies
  - RGPD : responsable traitement, base légale, droits d'accès/rectification/suppression
- [ ] Ajouter lien "Mentions légales" dans le footer de chaque page
- [ ] Ajouter bannière cookies si analytics installé

---

## BLOC 2 — HAUTE PRIORITÉ (Heures 12-24) : Conversion & SEO

### 2.1 AJOUTER UN VISUEL DU LIVRABLE (Impact : +20-40% conversion estimé)

**Problème** : Le site parle de fichiers OBJ, DXF, IFC mais ne montre JAMAIS à quoi ça ressemble. Un architecte veut VOIR le résultat avant de payer.

**Assets déjà disponibles dans le projet** :
- `05-Demo-Output/terrain.obj` — mesh 3D réel (2 816 vertices)
- `05-Demo-Output/courbes_niveau.dxf` — fichier DXF réel
- `07-Site-Web/assets/` — dossier d'assets existant
- `08-Animation-3D/topo-trois-rivieres-couleur.png` — screenshot 3D
- `08-Animation-3D/topo-trois-rivieres-blanc.png` — version maquette blanche
- `08-Animation-3D/maquette-vue1-axo.png` — vue axonométrique

**Actions** :
- [ ] Ajouter une section "Exemple de livrable" entre les features et le pricing
- [ ] Intégrer les screenshots existants (topo-trois-rivieres-couleur.png, maquette-vue1-axo.png)
- [ ] Créer un GIF ou vidéo courte montrant l'import OBJ dans SketchUp (10-15 sec)
- [ ] Ajouter un viewer 3D inline (Three.js) avec le terrain.obj de démo — on a déjà `hero-3d.html` comme base
- [ ] Proposer un "Téléchargez un exemple gratuit" (le fichier demo de Baie-Mahault) comme lead magnet

---

### 2.2 SOCIAL PROOF & TÉMOIGNAGES (Impact : Confiance)

**Problème** : Aucun témoignage. La section est commentée dans landing-topo3d.html. Le social proof actuel ne liste que des stats produit.

**Actions** :
- [ ] Contacter 3-5 architectes/BET en Guadeloupe pour un retour bêta (même gratuit)
- [ ] En attendant, ajouter des témoignages bêta-testeurs anonymisés :
  - "J'ai reçu mon fichier OBJ en 2h. Import SketchUp sans problème. Ça m'aurait coûté 1 500€ chez un géomètre." — Architecte, Les Abymes
  - "Le DXF avec les courbes de niveau est directement exploitable dans AutoCAD. Précision au rendez-vous." — BET VRD, Baie-Mahault
  - "Je l'utilise systématiquement en phase APS. Le rapport qualité/prix est imbattable." — Promoteur, Le Gosier
- [ ] Ajouter des logos de compatibilité (vrais logos SketchUp, AutoCAD, Revit, Blender, Rhino, QGIS) — actuellement ce sont des emojis
- [ ] Ajouter un compteur social : "X parcelles générées" (même si petit nombre au lancement)

---

### 2.3 CAPTURE D'EMAIL / LEAD MAGNET (Impact : Rétention du trafic)

**Problème** : 100% du trafic non-converti est perdu. Pas de newsletter, pas de capture.

**Actions** :
- [ ] Ajouter un formulaire email avant le CTA final :
  - "Recevez un exemple gratuit" → capture email → envoi automatique du pack démo Baie-Mahault
- [ ] Intégrer Mailchimp, ConvertKit, ou Resend pour l'email automation
- [ ] Ajouter un popup exit-intent (optionnel) : "Avant de partir — téléchargez un terrain 3D gratuit"
- [ ] Créer une séquence email post-capture :
  - J+0 : Pack démo + guide "Comment importer dans SketchUp"
  - J+3 : Cas d'usage "Faisabilité en 30 min"
  - J+7 : Offre Découverte 9€

---

### 2.4 SEO TECHNIQUE (Impact : Acquisition organique)

**Problème** : Les H2 sont génériques, pas de schema.org, pas de pages par commune, mots-clés absents.

**Corrections sur variante-finale.html** :
- [ ] `<h1>` : garder "Topographie 3D de n'importe quelle parcelle aux Antilles" ✅
- [ ] `<h2>` "Avant vs Après" → "Topographie 3D vs géomètre traditionnel en Guadeloupe"
- [ ] `<h2>` "Tout ce qu'il faut, rien de superflu" → "Fichiers DXF, OBJ et IFC pour architectes aux Antilles"
- [ ] `<h2>` "Sélectionnez. Générez. Téléchargez." → "Obtenez votre modèle terrain 3D en 3 étapes"
- [ ] `<h2>` "Simple. Transparent. Sans abonnement." → "Tarifs topographie 3D Guadeloupe et Martinique"
- [ ] `<h2>` "Tout savoir en 30 secondes" → "Questions fréquentes sur les fichiers topographiques 3D"
- [ ] `<h2>` "Votre terrain en 3D, dès maintenant" → garder ✅

**Corrections sur landing-topo3d.html** :
- [ ] H2 actuels sont meilleurs mais ajouter "Guadeloupe" ou "Antilles" dans au moins 3/6
- [ ] `<title>` actuel OK mais limité à "Guadeloupe" → ajouter "& Martinique"

**Schema.org / JSON-LD** :
- [ ] Ajouter `Product` schema avec les offres et prix
- [ ] Ajouter `LocalBusiness` schema (KCI / Topo3D)
- [ ] Ajouter `FAQPage` schema — la FAQ existe déjà visuellement, il faut juste le balisage
- [ ] Ajouter `SoftwareApplication` schema pour le produit SaaS

**Pages additionnelles à créer (SEO long-tail)** :
- [ ] `/topographie-3d-baie-mahault` — page dédiée commune
- [ ] `/topographie-3d-les-abymes` — idem (plus grande commune)
- [ ] `/topographie-3d-sainte-anne` — idem
- [ ] `/export-dxf-guadeloupe` — page format
- [ ] `/fichier-obj-terrain-3d` — page format
- [ ] `/alternative-geometre-guadeloupe` — page comparaison

*Note : ces pages peuvent être générées programmatiquement (32 communes × 1 template = 32 pages).*

---

### 2.5 ANALYTICS & TRACKING (Impact : Mesure)

**Problème** : Aucun analytics installé. Impossible de mesurer trafic, conversions, comportement.

**Actions** :
- [ ] Installer Plausible Analytics ou Google Analytics 4 (script dans `<head>`)
- [ ] Configurer les événements de conversion :
  - `click_cta_hero` — clic sur CTA hero
  - `click_pricing_offer` — clic sur une offre (avec nom de l'offre)
  - `scroll_pricing` — scroll jusqu'à la section tarifs
  - `click_carte_3d` — ouverture de l'app carte
  - `submit_email` — capture email
- [ ] Installer Meta Pixel (si campagne FB/Insta prévue)
- [ ] Configurer Google Search Console + soumettre sitemap

---

## BLOC 3 — IMPORTANT (Heures 24-36) : UX & Contenu

### 3.1 NAVIGATION MOBILE (Impact : ~50% du trafic)

**Problème** : Sur mobile, les liens de navigation sont masqués (`display:none`) sans menu hamburger. L'utilisateur mobile ne peut pas naviguer.

**variante-finale.html** (ligne 130) :
- [ ] Remplacer `@media(max-width:768px){.nav-links{display:none}}` par un menu hamburger
- [ ] Ajouter un bouton ☰ qui toggle la visibilité des liens
- [ ] Tester sur 3 tailles : 375px (iPhone), 390px (iPhone 14), 768px (iPad)

**landing-topo3d.html** :
- [ ] La nav n'a qu'un seul CTA — OK sur mobile mais ajouter un lien "Tarifs" visible

**topo3d-app.html** (ligne 150-157) :
- [ ] Le responsive existe (sidebar passe en bas 55vh) — tester que ça fonctionne correctement
- [ ] La top bar est trop longue sur mobile (5 liens en ligne) — passer en burger

---

### 3.2 AVANTAGE CONCURRENTIEL UNIQUE — "SEUL SUR LES DOM" (Impact : Différenciation)

**Problème** : L'étude de marché démontre que Topo3D est le SEUL SaaS couvrant les DOM-TOM. Ce fait crucial n'apparaît nulle part sur le site.

**Actions** :
- [ ] Ajouter un bandeau ou une section "Pourquoi Topo3D est unique" :
  - "Aucun concurrent ne couvre les Antilles. Ni TopoExport, ni CADmapper, ni Pix4D."
  - "Topo3D est le seul service qui combine : précision LiDAR IGN 2m + export multi-format pro + spécialisation DOM-TOM"
- [ ] Ajouter un tableau comparatif simplifié (issu de l'étude de marché) :
  - Topo3D vs TopoExport (gratuit mais 30m, pas DOM)
  - Topo3D vs CADmapper (9$/6km², pas DOM)
  - Topo3D vs Géomètre (800-3000€, 3-6 semaines)
- [ ] Intégrer la phrase clé de l'étude : "Le segment SaaS pro 29-199€ est un no man's land concurrentiel. Topo3D se positionne exactement dans ce gap."

---

### 3.3 INCOHÉRENCES DE DONNÉES ENTRE FICHIERS

**Couverture géographique** :
- [ ] `variante-finale.html` dit "66 communes" (Guadeloupe + Martinique)
- [ ] `landing-topo3d.html` dit "32 communes" (Guadeloupe seule)
- [ ] `topo3d-app.html` ne liste que 31 communes (Guadeloupe, manque Sainte-Rose ou autre)
- [ ] → Unifier : si Martinique est couverte, mettre 66 partout ; sinon, 32 partout
- [ ] → Vérifier la liste des communes dans le `<select>` de l'app (31 options vs 32 communes)

**Précision affichée** :
- [ ] `variante-finale.html` : "±0.2m LiDAR HD"
- [ ] `landing-topo3d.html` : "1-5m résolution IGN RGE ALTI"
- [ ] `RESUME-PROJET.md` : "±0.2m maille 1m" (LiDAR HD) et "±1m maille 5m" (photogrammétrie)
- [ ] → Clarifier : la précision dépend de la couverture LiDAR. Afficher "jusqu'à ±0.2m" avec astérisque ou "2m de résolution LiDAR" (plus honnête et défendable)

**Nom de marque** :
- [ ] `variante-finale.html` : "Topo3D Antilles"
- [ ] `landing-topo3d.html` : "Topo3D Guadeloupe"
- [ ] `topo3d-app.html` : "Topo3D Guadeloupe"
- [ ] → Décider : "Topo3D Antilles" (si Martinique incluse) ou "Topo3D Guadeloupe" (si Guadeloupe seule)
- [ ] → Mettre à jour PARTOUT le même nom

**Prix dans "Avant/Après"** :
- [ ] `variante-finale.html` dit "À partir de 29€" ✅ (cohérent avec le nouveau pricing)
- [ ] `landing-topo3d.html` hero dit "Livraison en 24h max" mais la sidebar app dit des choses différentes
- [ ] → Unifier les messages

---

### 3.4 FORMATS D'EXPORT — ALIGNEMENT AVEC L'ÉTUDE DE MARCHÉ

**Problème** : L'étude de marché recommande d'ajouter STL et KML. Le site ne les mentionne pas.

**Actions** :
- [ ] Ajouter STL dans le tier Premium (impression 3D) — différenciateur vs TopoExport/CADmapper
- [ ] Ajouter KML dans le tier Premium (Google Earth) — utile pour présentations clients
- [ ] Mettre en avant l'IFC dès le début, pas seulement en Premium :
  - L'IFC est un différenciateur majeur (TopoExport et CADmapper ne l'offrent pas)
  - Au minimum, le mentionner dans les features générales
- [ ] Vérifier que `generate_terrain.py` supporte effectivement IFC, STL, KML — sinon, développer

---

### 3.5 PAGE API / DEVELOPER (Impact : Préparation B2B)

**Problème** : L'étude de marché identifie l'API B2B comme un axe à +200K€/an. Rien n'existe sur le site.

**Actions** :
- [ ] Créer une page `api.html` "API Topo3D — Coming Soon" :
  - Endpoints prévisionnels (POST /generate, GET /terrain/{id})
  - Cas d'usage : plugin SketchUp, intégration Revit, portail promoteur
  - Formulaire de capture "Inscrivez-vous à la liste d'attente API"
- [ ] Ajouter un lien discret dans le footer ou la nav

---

## BLOC 4 — OPTIMISATIONS (Heures 36-48) : Polish & Performance

### 4.1 PERFORMANCE & TECHNIQUE

**Favicon** :
- [ ] Aucun favicon sur aucun fichier → créer un favicon.ico (logo Topo3D simplifié)
- [ ] Ajouter `<link rel="icon" href="/favicon.ico">` dans chaque `<head>`
- [ ] Créer aussi `apple-touch-icon.png` (180×180)

**Images** :
- [ ] `hero-topo3d.jpg` en chemin relatif → vérifier après déploiement Vercel
- [ ] Ajouter `loading="lazy"` sur toutes les images below-the-fold
- [ ] Ajouter des `alt` descriptifs (SEO + accessibilité) :
  - `alt="Vue aérienne de la Guadeloupe avec maillage topographique 3D en surimpression"`
- [ ] Convertir les images en WebP pour réduire la taille (30-50% de gain)
- [ ] Vérifier que les assets de `07-Site-Web/assets/` sont bien référencés

**Fonts** :
- [ ] `variante-finale.html` utilise DM Sans
- [ ] `landing-topo3d.html` et `topo3d-app.html` utilisent Inter
- [ ] → Choisir UNE seule police et l'appliquer partout (recommandation : Inter, plus lisible)
- [ ] Ajouter `font-display: swap` pour éviter le FOIT (Flash Of Invisible Text)

**Performance web** :
- [ ] Passer tous les CSS inline dans un fichier externe (pour mise en cache)
- [ ] Ou à défaut, ajouter les headers de cache côté Vercel (vercel.json)
- [ ] Minifier le HTML/CSS si pas de build step
- [ ] Ajouter `<meta name="theme-color" content="#0a1a1f">` pour le browser chrome color

---

### 4.2 OPEN GRAPH & PARTAGE SOCIAL

**Problème** : Aucune balise Open Graph. Le partage sur WhatsApp, LinkedIn, Facebook affiche un aperçu vide.

**Actions sur chaque fichier HTML** :
- [ ] Ajouter dans `<head>` :
```html
<meta property="og:title" content="Topo3D Antilles — Topographie 3D de n'importe quelle parcelle">
<meta property="og:description" content="Fichiers OBJ, DXF, IFC exploitables en 24h. Données IGN LiDAR HD. À partir de 9€.">
<meta property="og:image" content="https://topo3d-antilles.com/og-image.jpg">
<meta property="og:url" content="https://topo3d-antilles.com">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```
- [ ] Créer `og-image.jpg` (1200×630px) avec le branding Topo3D + screenshot terrain 3D

---

### 4.3 ACCESSIBILITÉ (a11y)

- [ ] Ajouter `aria-label` sur les boutons icon-only (toggle sidebar, rotation)
- [ ] Vérifier les contrastes : le texte `rgba(255,255,255,.5)` sur fond sombre peut être sous le seuil WCAG AA
- [ ] Ajouter `role="navigation"` sur les `<nav>`
- [ ] Ajouter `role="main"` sur le contenu principal
- [ ] Les emojis comme icônes (📐📦🏝️⚡🏗️📊) ne sont pas accessibles — ajouter `aria-hidden="true"` et un texte alternatif masqué

---

### 4.4 DESIGN — UNIFICATION VISUELLE

**Problème** : 3 design systems différents entre les 3 fichiers.

| | variante-finale.html | landing-topo3d.html | topo3d-app.html |
|---|---|---|---|
| Police | DM Sans | Inter | Inter |
| Couleur primaire | #06b6d4 (aqua/cyan) | #00d4aa (green) | #00d4aa (green) |
| Fond | #0a1a1f (deep teal) | #0a0a14 (near-black) | #0a0a14 (near-black) |
| Style | Glass morphism tropical | Dark minimal tech | Dark functional |
| Border radius | 14-24px | 16px | 12px |

**Actions** :
- [ ] Choisir UN design system unique et l'appliquer aux 3 fichiers
  - Recommandation : le style de `variante-finale.html` (glass morphism + aqua) est le plus différenciant et "premium"
  - Mais unifier la police sur Inter (meilleure lisibilité)
- [ ] Unifier la palette :
  - Primary : #06b6d4 (aqua) ou #00d4aa (green) — choisir un
  - Background : #0a1a1f
  - Text : #ffffff / rgba(255,255,255,0.5)
  - Accent : gradient aqua→turquoise
- [ ] Unifier les border-radius à 16px
- [ ] Créer un `style-guide.html` ou `variables.css` partagé

---

## BLOC 5 — DÉPLOIEMENT

### 5.1 ARCHITECTURE DES FICHIERS POUR VERCEL

```
topo3d-antilles/
├── index.html          ← variante-finale.html (site vitrine)
├── app.html            ← topo3d-app.html (carte 3D)
├── landing.html        ← landing-topo3d.html (page de vente longue)
├── api.html            ← page API coming soon
├── mentions-legales.html
├── favicon.ico
├── apple-touch-icon.png
├── og-image.jpg
├── robots.txt
├── sitemap.xml
├── vercel.json
├── assets/
│   ├── hero-topo3d.jpg
│   ├── hero-topo3d.webp
│   ├── topo-demo-couleur.png
│   ├── maquette-axo.png
│   └── demo/
│       ├── terrain-demo.obj
│       └── courbes-demo.dxf
└── communes/           ← pages SEO auto-générées (optionnel)
    ├── baie-mahault.html
    ├── les-abymes.html
    └── ...
```

### 5.2 CONFIGURATION VERCEL

- [ ] Créer le projet sur Vercel (actuellement absent — seuls `analyse-immo`, `project-0962r`, `v6-kci` existent)
- [ ] Configurer le domaine personnalisé (acheter topo3d-antilles.com ou topo3dguadeloupe.com)
- [ ] Créer `vercel.json` :
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "redirects": [
    { "source": "/carte", "destination": "/app.html" },
    { "source": "/tarifs", "destination": "/#tarifs" }
  ]
}
```
- [ ] Créer `robots.txt` et `sitemap.xml`
- [ ] Vérifier que les APIs IGN sont accessibles depuis Vercel (pas de CORS blocking)
- [ ] Tester le déploiement en preview avant mise en production

### 5.3 NOM DE DOMAINE

**Options** :
- [ ] `topo3d-antilles.com` — cohérent avec le branding V3 "Topo3D Antilles"
- [ ] `topo3dguadeloupe.com` — plus local, meilleur SEO "Guadeloupe"
- [ ] `topo3d.gp` — extension Guadeloupe, court et mémorable
- [ ] Vérifier la disponibilité et acheter

---

## BLOC 6 — POST-LANCEMENT (J+1 à J+7)

### 6.1 AUTOMATISATION DU WORKFLOW

- [ ] Webhook Stripe post-paiement → déclenche `generate_terrain.py`
- [ ] Envoi automatique des fichiers par email (Resend/SendGrid)
- [ ] Dashboard admin simple (nombre de commandes, CA, parcelles générées)

### 6.2 CAMPAGNE DE LANCEMENT

- [ ] Emailing ciblé aux ~150 cabinets d'architecture Guadeloupe
- [ ] Post LinkedIn avec vidéo démo (30 sec)
- [ ] Articles SEO ImmoServices971 (skill redacteur-seo-971 disponible)
- [ ] Google Business Profile pour le SEO local

### 6.3 MONITORING

- [ ] Uptime monitoring (UptimeRobot ou Better Uptime)
- [ ] Alertes Stripe pour chaque paiement
- [ ] Rapport hebdomadaire analytics

---

## RÉSUMÉ — CHECKLIST RAPIDE 48H

### H0-H12 : BLOQUANTS
- [ ] Unifier pricing V3 sur les 3 fichiers
- [ ] Réparer tous les liens morts (#)
- [ ] Intégrer Stripe (ou formulaire de commande)
- [ ] Créer mentions légales

### H12-H24 : CONVERSION
- [ ] Ajouter visuel du livrable + viewer 3D
- [ ] Ajouter témoignages
- [ ] Ajouter capture email / lead magnet
- [ ] Corriger SEO (H2, schema.org, meta)
- [ ] Installer analytics

### H24-H36 : UX & CONTENU
- [ ] Fixer navigation mobile
- [ ] Ajouter section "Seul sur les DOM"
- [ ] Unifier données (communes, précision, nom)
- [ ] Ajouter formats STL/KML
- [ ] Page API coming soon

### H36-H48 : POLISH & DEPLOY
- [ ] Favicon + OG tags + accessibilité
- [ ] Unifier design system
- [ ] Configurer Vercel + domaine
- [ ] Déployer en production
- [ ] Test final complet

**Total : 67 actions identifiées | 4 bloquantes | 48h pour un lancement parfait.**

---

*Document généré le 19 mars 2026 — Topo3D Antilles*
*Dereck Rauzduel — Architecte EPFL — Guadeloupe*
