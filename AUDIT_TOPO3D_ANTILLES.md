# AUDIT COMPLET — topo3d-antilles.vercel.app
**Date :** 22 mars 2026
**Auditeur :** Claude (session Cowork)
**Projet :** topo3d-antilles (Vercel prj_Zd2Ea9TbnXli5g9OTYhOgkUfaKgG)

---

## 1. RÉSUMÉ EXÉCUTIF

Le site topo3d-antilles est en **état critique** : le code source local (corrigé) n'a jamais été déployé. La version en production est une ancienne version datant du 20 mars avec un middleware bloquant toutes les pages vers un écran de login obsolète. **6 API routes sur 8 retournent 404**, la carte 3D ne fonctionne pas.

| Catégorie | Score | Statut |
|-----------|-------|--------|
| Fonctionnel | 2/10 | CRITIQUE — la plupart des features sont cassées |
| Sécurité | 7/10 | BON — quelques points à améliorer |
| Performance | 6/10 | MOYEN — optimisations possibles |
| SEO | 8/10 | BON — bien structuré |
| UX/Design | 7/10 | BON — clean, responsive |
| Code Quality | 6/10 | MOYEN — quelques bugs et inconsistances |

---

## 2. BUGS CRITIQUES IDENTIFIÉS ET CORRIGÉS

### BUG #1 — Code non déployé (CRITIQUE)
**Symptôme :** La majorité du site ne fonctionne pas. Pages publiques (index, CGV, comment-ça-marche) bloquées par le middleware, API routes en 404.
**Cause :** Le code source dans `02_Topo3D/Site_Web/` a été modifié mais jamais redéployé sur Vercel. La version en production est une ancienne version avec un middleware restrictif.
**Correction :** Redéployer le code (voir section 7).

### BUG #2 — webhook.js : ReferenceError (CORRIGÉ ✅)
**Fichier :** `api/webhook.js` ligne 154
**Symptôme :** Endpoint `/api/webhook` crash avec 500 FUNCTION_INVOCATION_FAILED
**Cause :** Variable `emailHtml` utilisée à la place de `htmlContent` (définie ligne 107)
**Correction appliquée :** Renommé `emailHtml` → `htmlContent`

### BUG #3 — carte.html : mapping données GeoJSON cassé (CORRIGÉ ✅)
**Fichier :** `carte.html` lignes 1069-1109
**Symptôme :** Après sélection d'une parcelle, le panneau latéral affiche "N/A" partout
**Cause :** L'API contours retourne un GeoJSON Feature `{ type, geometry, properties: { commune, section... } }` mais carte.html accédait à `data.commune` au lieu de `data.properties.commune`
**Correction appliquée :** Ajout d'un aplatissement du Feature GeoJSON pour extraire les properties au niveau racine

### BUG #4 — carte.html : appel fiche-parcelle malformé (CORRIGÉ ✅)
**Fichier :** `carte.html` ligne 1290-1296
**Symptôme :** L'API fiche-parcelle retourne 400 "Missing parcel information"
**Cause :** carte.html envoyait `{ parcel: state.selectedParcel }` mais l'API attend `{ commune, section, numero, lat, lon }`
**Correction appliquée :** Extraction et envoi explicite des champs requis

### BUG #5 — Image hero manquante
**Fichier :** `hero-topo3d.webp`
**Symptôme :** Le fond d'écran des pages index.html et login.html est noir/vide
**Cause :** Le fichier `hero-topo3d.webp` n'existe pas dans le répertoire source
**Correction nécessaire :** Ajouter une image hero de terrain/topographie au format webp

---

## 3. AUDIT SÉCURITÉ

### 3.1 Points positifs ✅
- **Middleware Edge** : protection des routes sensibles (carte, APIs d'export) par vérification de cookie de session
- **CORS restrictif** : whitelist d'origines autorisées (topo3d-antilles.com + *.vercel.app preview)
- **Rate limiting login** : 5 tentatives par minute par IP
- **Cookies HttpOnly + Secure + SameSite=Lax** : bonne protection contre XSS et CSRF
- **Session avec expiration** : durée max 7 jours, format timestamp.hash
- **Pas de fallback hardcodé** : credentials uniquement via env vars (BETA_USER/BETA_PASS)
- **Request ID** : chaque réponse API a un X-Request-ID unique (traçabilité)
- **Headers de sécurité** : X-Content-Type-Options, X-Frame-Options DENY, HSTS, CSP, Permissions-Policy
- **Vérification signature Stripe** : webhook utilise HMAC-SHA256 + timingSafeEqual

### 3.2 Points d'amélioration ⚠️
- **Sessions in-memory** : les sessions sont stockées dans une Map en mémoire (volatile, perdue au cold start Vercel). Pas critique en bêta, mais à remplacer par Redis/KV en production
- **Rate limiting in-memory** : même problème que les sessions, reset au cold start
- **CORS wildcard Vercel** : `origin.includes('.vercel.app')` accepte TOUT domaine *.vercel.app, pas seulement les previews du projet. Recommandation : restreindre à `topo3d-antilles*.vercel.app`
- **CSP connect-src large** : autorise de nombreux domaines externes. Acceptable pour les APIs IGN/Géorisques
- **Pas de CSRF token** : les cookies SameSite=Lax protègent mais un token dédié serait mieux
- **Pas de Content-Security-Policy-Report-Only** : ajouter pour monitorer les violations CSP

### 3.3 Variables d'environnement requises
- `BETA_USER` — identifiant beta (obligatoire pour login)
- `BETA_PASS` — mot de passe beta (obligatoire pour login)
- `STRIPE_WEBHOOK_SECRET` — secret Stripe pour vérifier les webhooks
- `RESEND_API_KEY` — clé API Resend pour envoyer les emails

---

## 4. AUDIT PERFORMANCE

### 4.1 Points positifs ✅
- **CSS inline** : pas de requête CSS supplémentaire, LCP rapide
- **Police DM Sans** : chargée via preconnect + Google Fonts (bonne pratique)
- **Images WebP** : format hero en webp (optimal si le fichier existait)
- **Headers cache** : fichiers statiques et polices avec `max-age=31536000, immutable`
- **Vercel Edge Network** : CDN global, bon TTFB
- **MapLibre GL** : bibliothèque de cartes légère via CDN unpkg

### 4.2 Points d'amélioration ⚠️
- **Pas de Service Worker** : pas de cache offline
- **CSS inline massif** : ~900 lignes de CSS dans index.html, pourrait être externalisé et mis en cache
- **Pas de lazy loading** : l'image hero n'a pas `loading="lazy"` (mais c'est au-dessus du fold, donc OK)
- **MapLibre chargé en synchrone** : pourrait être chargé en async/defer
- **Pas de compression d'images** : hero-topo3d.webp manquant
- **Pas de font-display: swap** : déjà dans l'URL Google Fonts (`display=swap`), OK
- **Serverless cold starts** : les fonctions API peuvent avoir des cold starts de 200-500ms

---

## 5. AUDIT SEO

### 5.1 Points positifs ✅
- **Meta tags complets** : title, description, keywords sur toutes les pages
- **Open Graph** : og:title, og:description, og:image, og:url sur index.html
- **Twitter Card** : summary_large_image avec image
- **Schema.org** : WebSite, SoftwareApplication, FAQPage (structured data riche)
- **Canonical URL** : défini sur index.html et cgv.html
- **Sitemap implicite** : pages bien liées entre elles
- **URLs propres** : rewrites Vercel pour /comment-ca-marche, /cgv, /references
- **Robots meta** : `index, follow` sur les CGV
- **Accessibilité** : skip-link, aria-labels, focus-visible, prefers-reduced-motion

### 5.2 Points d'amélioration ⚠️
- **Pas de sitemap.xml** : en ajouter un pour le crawling
- **Pas de robots.txt** : en ajouter un basique
- **OG image manquante** : hero-topo3d.webp n'existe pas, l'aperçu social sera vide
- **Pas de hreflang** : pas nécessaire pour l'instant (site FR uniquement)
- **Titre h2 "Nous vous faisons confiance"** : ambigu, devrait être "Ils nous font confiance" ou "Pourquoi nous choisir"
- **FAQ "Qui paie le support client?"** : question étrange, reformuler en "Comment contacter le support ?"

---

## 6. AUDIT UX / DESIGN

### 6.1 Points positifs ✅
- **Design cohérent** : palette #00c896/#0a0a14 consistante sur toutes les pages
- **Responsive** : breakpoints mobile à 768px et 480px
- **Navigation claire** : nav fixe avec hamburger mobile
- **CTA visible** : bouton vert "Accéder à la Carte" bien contrasté
- **Pricing clair** : 4 offres avec features listées et badges
- **FAQ accordéon** : interactions fluides
- **Loading states** : spinner et messages de chargement sur carte.html
- **Animations réduites** : support prefers-reduced-motion

### 6.2 Points d'amélioration ⚠️
- **Boutons pricing sans lien** : les `<button>` "Commander" n'ont aucun onClick/href → rien ne se passe au clic
- **Page login différente de login.html déployé** : le code local a un design différent de celui en production
- **Pas de page 404 personnalisée** : les erreurs affichent "The page could not be found" brut de Vercel
- **Pas de toast/notification globale** : les erreurs réseau sur la page d'accueil ne sont pas visibles
- **Footer "Suivez-nous"** : section vide, pas de liens sociaux

---

## 7. INSTRUCTIONS DE DÉPLOIEMENT

Le code source corrigé est dans : `SYNTHESE ECOSYSTEME/02_Topo3D/Site_Web/`

### Déploiement rapide (30 secondes)
```bash
cd "SYNTHESE ECOSYSTEME/02_Topo3D/Site_Web"
npx vercel --prod
```

### Vérification post-déploiement
Après déploiement, vérifier :
1. `https://topo3d-antilles.com` → page d'accueil (pas login)
2. `https://topo3d-antilles.com/comment-ca-marche` → page publique
3. `https://topo3d-antilles.com/cgv` → page CGV
4. `https://topo3d-antilles.com/references` → mentions légales
5. `https://topo3d-antilles.com/carte` → redirige vers login (protégée)
6. `https://topo3d-antilles.com/api/contours?lat=16.25&lon=-61.55` → JSON parcelle
7. Login avec identifiants beta → accès carte
8. Clic sur la carte → panneau parcelle s'affiche avec données

### Image hero manquante
Ajouter un fichier `hero-topo3d.webp` (image de terrain topographique, ~200-400KB, 1920x1080) dans le dossier racine du site.

---

## 8. FICHIERS MODIFIÉS DANS CETTE SESSION

| Fichier | Modification |
|---------|-------------|
| `api/webhook.js` | Fix variable emailHtml → htmlContent (ligne 154) |
| `carte.html` | Fix mapping GeoJSON Feature → propriétés aplaties |
| `carte.html` | Fix appel API fiche-parcelle avec champs explicites |

---

## 9. RECOMMANDATIONS PRIORITAIRES

### Court terme (avant lancement bêta)
1. ⚡ **Déployer le code corrigé** (5 min)
2. 🖼️ **Ajouter hero-topo3d.webp** (image de fond)
3. 🔗 **Brancher les boutons Commander** aux sessions Stripe
4. 📄 **Ajouter sitemap.xml et robots.txt**
5. 🚫 **Ajouter une page 404 personnalisée**

### Moyen terme (amélioration continue)
6. 🔒 Migrer sessions vers Vercel KV ou Redis
7. 📊 Ajouter analytics (Plausible ou Umami, RGPD-friendly)
8. 🧪 Ajouter des tests API automatisés
9. 📧 Configurer un domaine d'envoi email vérifié sur Resend
10. 🔄 Connecter un repo GitHub pour les déploiements automatiques
