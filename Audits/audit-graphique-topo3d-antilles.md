# Audit Graphique Détaillé — Topo3D Antilles

**Date :** 19 mars 2026
**Fichier audité :** `index-final.html`
**Statut :** Site one-page, pré-déploiement

---

## 1. Structure HTML & Sémantique

### Constats

Le HTML est fonctionnel mais souffre de plusieurs faiblesses sémantiques qui impactent le SEO et l'accessibilité.

**Problèmes identifiés :**

- **Pas de balise `<main>`** — tout le contenu est dans un `<div class="page-content">`. Les moteurs de recherche et lecteurs d'écran ne peuvent pas identifier la zone de contenu principal.
- **Hiérarchie `<h>` incohérente** — Le `<h1>` est unique (bon), mais les sections utilisent `<h2>` via `.stitle` alors que les titres de cards utilisent `<h3>`. La section "Avant/Après" a ses `<h3>` dans des `<div>` sans `<section>` propre.
- **Attributs `id` manquants** — La section Features n'a pas d'`id` (`#produit` est sur Avant/Après, pas sur Features). Le lien nav "Produit" pointe sur la comparaison, pas sur les features.
- **Pas de `role` ni `aria-label`** — La `<nav>` n'a pas d'`aria-label`. Les boutons CTA sont des `<a href="#">` sans `role="button"`.
- **Pas de favicon ni d'Open Graph** — Manque `og:title`, `og:description`, `og:image` pour le partage social, et pas de `<link rel="icon">`.

### Solutions

| Priorité | Action | Impact |
|----------|--------|--------|
| P1 | Envelopper `page-content` dans `<main>` | SEO + Accessibilité |
| P1 | Ajouter `og:title`, `og:image`, `og:description` + favicon | Partage social |
| P2 | Ajouter `aria-label="Navigation principale"` sur `<nav>` | Accessibilité |
| P2 | Donner un `id="features"` à la section Features, corriger le lien nav | UX navigation |
| P3 | Transformer les CTA `<a href="#">` en `<a href="https://app.topo3d.gp">` avec de vrais liens | SEO + Conversion |

---

## 2. Design System — Couleurs, Typographie, Espacements

### Palette de couleurs

La palette actuelle est cohérente et professionnelle :

| Token | Valeur | Usage | Verdict |
|-------|--------|-------|---------|
| `--aqua` | `#06b6d4` | Accent principal | OK — Tailwind Cyan 500 |
| `--turquoise` | `#2dd4bf` | Accent secondaire | OK — Tailwind Teal 400 |
| `--bg-deep` | `#0a1a1f` | Fond page | OK mais très sombre |
| `--text` | `#fff` | Texte principal | OK |
| `--muted` | `rgba(255,255,255,.55)` | Texte secondaire | **Problème contraste** |
| `--glass` | `rgba(255,255,255,.06)` | Fond cards | OK |
| `--glass-border` | `rgba(255,255,255,.1)` | Bordures | Subtil, ok |

**Problèmes identifiés :**

- **Contraste insuffisant du texte `--muted`** — `rgba(255,255,255,.55)` sur fond sombre (`#0a1a1f`) donne un ratio d'environ **3.2:1**, en dessous du minimum WCAG AA de 4.5:1 pour le texte normal. Cela concerne tous les paragraphes, descriptions, et prix secondaires — soit ~60% du texte visible.
- **Pas de couleur d'erreur/warning** — Si un jour on ajoute des formulaires, il n'y a pas de token rouge/orange.
- **Le `--gradient-warm` (cyan→violet) est déclaré mais jamais utilisé** — code mort.

### Typographie

- **DM Sans** est un excellent choix pour le SaaS/tech. Bonne lisibilité.
- **Un seul font-weight** chargé via l'URL mais la range `300-800` est demandée — OK pour le variable font.
- **Tailles de texte** : le texte de body descend à `12px` et `12.5px` sur les cards features et pricing. C'est trop petit sur desktop pour du texte de paragraphe (recommandation minimale : 14px).
- **Line-height** : `1.6` sur le body est bien, mais `1.06` sur le `<h1>` est trop serré pour les lignes longues — risque de chevauchement de lettres sur mobile.

### Espacements

- **Gap de 12px entre les cards** (features, steps, pricing) — C'est serré. 16px serait plus aéré.
- **Padding sections** : `80px 0` est homogène et cohérent — bon.
- **Le hero** a `110px` de padding-top pour compenser la nav fixe — fonctionnel.
- **Container** : `max-width: 1060px` est étroit pour une grille 3 colonnes avec du contenu riche. 1140px ou 1200px serait plus confortable.

### Solutions

| Priorité | Action | Impact |
|----------|--------|--------|
| **P0** | **Passer `--muted` à `rgba(255,255,255,.7)` minimum** | Accessibilité WCAG |
| P1 | Augmenter les tailles de texte cards à 13.5px minimum | Lisibilité |
| P2 | Passer le gap des grilles de 12px à 16px | Aération visuelle |
| P2 | Augmenter le `line-height` du h1 à `1.12` | Anti-chevauchement mobile |
| P3 | Supprimer `--gradient-warm` (inutilisé) | Propreté code |
| P3 | Élargir container à 1140px | Confort lecture grille |

---

## 3. Animations & Performances CSS

### Inventaire des animations

Le site a **8 animations CSS** simultanées :

| Animation | Durée | Type | Impact GPU |
|-----------|-------|------|-----------|
| `gridDrift` | 40s | `transform` | **Élevé** — tourne sur un élément 200%×200% |
| `contourPulse` | 8s × 8 éléments | `transform + opacity` | Moyen |
| `meshShift` | 60s | `background-position` | **Élevé** — repaint continu |
| `dotFloat` | 6s × 8 éléments | `transform + opacity` | Faible |
| `glowShift` | 12s | `transform + opacity` | Moyen |
| `scanDown` | 8s | `top` | **Problème** — anime `top` (layout) |
| `fadeUp` | 0.8s | `transform + opacity` | OK (one-shot) |
| `blink` | 2s | `opacity` | Faible |

**Problèmes identifiés :**

- **`scanDown` anime la propriété `top`** — Cela déclenche un recalcul de layout à chaque frame (layout thrashing). Il faut utiliser `transform: translateY()` à la place.
- **`meshShift` anime `background-position`** — Cela force un repaint à chaque frame. Sur mobile, cela peut causer du jank.
- **`gridDrift` sur un élément 200%×200%** — L'élément `.topo-grid` fait 4× la taille du viewport avec une perspective 3D. C'est lourd en compositing.
- **Pas de `will-change`** déclaré — Le navigateur ne peut pas optimiser le compositing des éléments animés.
- **Pas de `prefers-reduced-motion`** — Les utilisateurs avec des troubles vestibulaires ne peuvent pas désactiver les animations.
- **8 backdrop-filter:blur(16-24px)** simultanés à l'écran — Le blur est très coûteux en GPU. Sur mobile bas de gamme, cela peut causer des freezes.

### Solutions

| Priorité | Action | Impact |
|----------|--------|--------|
| **P0** | **Remplacer `top` par `transform: translateY()` dans `scanDown`** | Performance (élimine layout thrashing) |
| **P0** | **Ajouter `@media (prefers-reduced-motion: reduce)` pour couper les animations** | Accessibilité |
| P1 | Ajouter `will-change: transform` sur `.topo-grid`, `.topo-scan`, `.topo-glow` | Performance GPU |
| P1 | Remplacer `background-position` par `transform: translate()` dans `meshShift` | Performance (élimine repaint) |
| P2 | Réduire le nombre de `backdrop-filter` à 3-4 max simultanés (remplacer les autres par des `background` opaques) | Performance mobile |
| P3 | Réduire `.topo-grid` de 200% à 150% | Mémoire GPU |

---

## 4. Responsive & Mobile

### Constats

Le responsive est **minimal** — une seule breakpoint à `768px` avec 7 règles :

```css
@media(max-width:768px){
    .feat-grid,.steps,.price-grid,.about-grid{grid-template-columns:1fr}
    .nav-links{display:none}
    .hero-glass{padding:32px 20px}
    .compare-grid{grid-template-columns:1fr;gap:12px}
    .vs{display:none}
    .guarantee-box{flex-direction:column;text-align:center}
    .guarantee-text{text-align:center}
    .final-glass{padding:40px 20px}
}
```

**Problèmes identifiés :**

- **Un seul breakpoint** — Pas de breakpoint tablette (1024px). Sur iPad, la grille 3 colonnes est écrasée avec du texte à 12px.
- **Nav : les liens disparaissent** sur mobile mais il n'y a **pas de menu hamburger**. L'utilisateur perd toute navigation sauf le CTA.
- **Le hero-glass fait toujours 700px max-width** — Sur un téléphone de 375px, le padding de 20px + les marges = le texte est très compressé.
- **Les stats-row pilules** ne wrappent pas bien — sur petit écran, elles passent sur 2 lignes désordonnées.
- **La grille pricing en 1 colonne** empile 3 cards longues — l'utilisateur doit scroller longtemps pour les comparer.
- **Font-sizes non adaptées** — Le `h1` clamp est bon (`clamp(30px,5vw,48px)`), mais le texte de body/cards reste à 12-13px sur mobile (devrait monter à 14px).
- **Le fond animé CSS** consomme du GPU sur mobile sans bénéfice visible (l'overlay le couvre aux 2/3 de la page).
- **Pas de touch targets** vérifiés — Les liens nav font ~12px de font avec un gap de 18px, et les CTA sont à 12px de padding vertical (minimum recommandé : 44px de hauteur).

### Solutions

| Priorité | Action | Impact |
|----------|--------|--------|
| **P0** | **Ajouter un menu hamburger mobile** | UX mobile critique |
| P1 | Ajouter un breakpoint tablette `@media(max-width:1024px)` → grilles en 2 colonnes | UX tablette |
| P1 | Augmenter les font-sizes mobiles : body à 14px, cards à 13px minimum | Lisibilité mobile |
| P1 | Désactiver les animations de fond sur mobile (`prefers-reduced-motion` + media query) | Performance mobile |
| P2 | Transformer le pricing mobile en tabs ou carousel horizontal | Comparabilité |
| P2 | Augmenter les touch targets des CTA à 48px minimum | UX tactile |
| P3 | Ajouter un breakpoint `max-width:480px` pour les très petits écrans | Compatibilité |

---

## 5. Conversion & UX

### Parcours utilisateur actuel

```
Hero → Social Proof → Avant/Après → Features → 3 étapes → Pricing → Garantie → About → CTA final → Footer
```

### Points forts

- **Le bloc Avant/Après est excellent** — comparaison claire, différenciation immédiate.
- **La social proof est bien placée** (juste après le hero).
- **3 niveaux de prix** avec badge "Populaire" — pattern éprouvé.
- **Bloc garantie** rassurant.
- **Les stats pills** (`±0.2m`, `66 communes`, `<24h`, `50× moins cher`) sont des chiffres percutants.

### Problèmes identifiés

- **Aucune preuve sociale concrète** — "Conçu par un architecte EPFL" est une crédibilité individuelle, mais il n'y a pas de témoignages clients, pas de nombre de parcelles générées, pas de logos clients. C'est le levier de conversion #1 qui manque.
- **Tous les CTA pointent vers `#`** — Aucun bouton ne mène nulle part. C'est le bloqueur absolu de conversion.
- **Pas de formulaire** — Ni email capture, ni formulaire de contact, ni chat. Le visiteur ne peut pas agir.
- **Section "Comment ça marche" avant Pricing** — C'est classique, mais le parcours pourrait bénéficier d'un aperçu visuel du produit (screenshot de la carte 3D / démo) AVANT d'expliquer comment ça marche.
- **Pas de section FAQ** — Les questions fréquentes (précision des données, différence avec un géomètre, délai réel, format de fichier) lèvent des objections. C'est un accélérateur de conversion standard.
- **Pas de démo/aperçu du produit** — Le visiteur ne voit JAMAIS à quoi ressemble le livrable. Un screenshot ou une iframe de `carte.html` serait un game-changer.
- **Le CTA principal dit "Ouvrir la carte 3D"** mais la carte n'est pas intégrée dans le one-page. Rupture de promesse.
- **Footer trop minimaliste** — Pas d'email, pas de téléphone, pas de liens sociaux, pas de SIRET.

### Solutions

| Priorité | Action | Impact |
|----------|--------|--------|
| **P0** | **Lier les CTA à carte.html ou à l'app réelle** | Conversion (sans ça, 0% de conversion) |
| **P0** | **Ajouter une section "Aperçu du produit"** avec screenshot/iframe de la carte 3D ou du fichier OBJ | Conviction (le prospect voit le produit) |
| P1 | Ajouter une section FAQ (5-6 questions) | Lever les objections |
| P1 | Ajouter un formulaire email capture ("Recevez un exemple gratuit") | Lead generation |
| P1 | Ajouter des chiffres de social proof réels ("X parcelles générées", "Y architectes utilisateurs") | Crédibilité |
| P2 | Ajouter un témoignage client (même fictif/beta-testeur au début) | Preuve sociale |
| P2 | Ajouter des liens sociaux + email + SIRET dans le footer | Confiance légale |
| P2 | Ajouter un compteur/urgence ("Offre de lancement -30%" ou "X parcelles restantes ce mois") | FOMO |
| P3 | Intégrer un chatbot ou Calendly pour prise de contact | Engagement |

---

## 6. Cohérence avec l'écosystème

### Constats

Le dossier `07-Site-Web` contient **19 fichiers** dont 9 variantes HTML, des previews JPG, et des pages annexes (`carte.html`, `references.html`, `hero-3d.html`). Ces pages annexes utilisent un design system différent (couleurs `#00d4aa`, police différente).

**Problèmes :**

- **Pas de design system partagé** — `carte.html` utilise ses propres couleurs/polices, non alignées avec `index-final.html`.
- **Le fichier `hero-3d.html` (Three.js)** est une démo 3D autonome et magnifique qui n'est pas intégrée dans la landing.
- **9 variantes HTML** polluent le dossier — elles devraient être archivées.
- **Pas de `index.html` principal** — L'ancien `index.html` coexiste avec `index-final.html`.

### Solutions

| Priorité | Action | Impact |
|----------|--------|--------|
| P1 | Renommer `index-final.html` → `index.html` (écraser l'ancien) | Déploiement |
| P1 | Aligner le design de `carte.html` sur la palette de `index-final.html` | Cohérence marque |
| P1 | Intégrer le hero Three.js de `hero-3d.html` dans la landing (section aperçu) | WOW effect |
| P2 | Archiver les variantes dans un sous-dossier `_archives/` | Propreté |
| P3 | Créer un fichier `style.css` partagé entre toutes les pages | Maintenabilité |

---

## 7. Matrice de Priorisation

### Priorité 0 — Bloquants (à corriger avant mise en ligne)

1. **Lier les CTA à de vrais liens** (carte.html, Stripe, formulaire)
2. **Corriger le contraste du texte** (`--muted` à .7 minimum)
3. **Ajouter un menu hamburger mobile**
4. **Corriger l'animation `scanDown`** (utiliser `transform` au lieu de `top`)
5. **Ajouter `prefers-reduced-motion`**

### Priorité 1 — Fort impact conversion

6. Ajouter une section "Aperçu produit" (screenshot carte 3D ou iframe)
7. Ajouter une section FAQ
8. Formulaire email capture ou lead magnet
9. Breakpoint tablette (1024px)
10. Renommer en `index.html`, aligner carte.html sur le design

### Priorité 2 — Polish & optimisation

11. Augmenter les font-sizes et gaps
12. Ajouter témoignages et social proof chiffrée
13. Footer complet (email, SIRET, réseaux)
14. Réduire les `backdrop-filter` sur mobile
15. Pricing mobile en carousel/tabs

### Priorité 3 — Nice to have

16. Intégrer le hero Three.js
17. Archiver les variantes
18. CSS partagé entre les pages
19. Chatbot ou Calendly
20. Open Graph + favicon

---

## 8. Score Global

| Critère | Note /10 | Commentaire |
|---------|----------|-------------|
| **Design visuel** | 8/10 | Glassmorphism élégant, palette cohérente, fond CSS créatif |
| **Structure HTML** | 5/10 | Manque sémantique, pas de `<main>`, pas d'OG tags |
| **Typographie** | 7/10 | DM Sans excellent, mais tailles trop petites sur les cards |
| **Animations** | 6/10 | Belles mais non optimisées, pas d'option reduced-motion |
| **Responsive** | 4/10 | Un seul breakpoint, pas de menu mobile, pas de tablette |
| **Performance** | 5/10 | backdrop-filter lourd, animations GPU non optimisées |
| **Conversion** | 3/10 | CTA morts, pas de démo produit, pas de FAQ, pas de leads |
| **Accessibilité** | 3/10 | Contraste faible, pas d'aria, pas de reduced-motion |
| **Cohérence eco.** | 4/10 | Pages annexes désalignées, variantes non archivées |
| **SEO** | 5/10 | Meta description OK, mais pas d'OG, pas de structured data |

**Score moyen : 5.0/10**

Le design visuel est la grande force du site. Les faiblesses majeures sont le responsive, la conversion (aucun CTA fonctionnel) et l'accessibilité. Les 5 corrections P0 permettraient de passer immédiatement à ~7/10.
