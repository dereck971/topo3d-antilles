# Topo3D Guadeloupe — Résumé du Projet

## Vision

**Topo3D Guadeloupe** est un service SaaS de génération automatique de fichiers topographiques 3D exploitables (.OBJ + .DXF) à partir de n'importe quelle parcelle cadastrale en Guadeloupe. Destiné aux architectes, géomètres et bureaux d'études, il remplace l'attente de 3-6 semaines pour un relevé topo classique par une livraison en quelques heures.

## Problème résolu

| Aujourd'hui | Avec Topo3D |
|---|---|
| 3-6 semaines d'attente | Livraison en < 24h |
| 800€ - 3 000€ par relevé | À partir de 49€ |
| PDF non exploitable | Fichiers OBJ + DXF importables directement |
| Géomètre à contacter, devis, RDV terrain | 100% en ligne, sélection en 1 clic |

## Public cible

- Architectes DPLG/DE (Guadeloupe : ~150 cabinets)
- Bureaux d'études techniques VRD/structure (~80 en 971)
- Promoteurs immobiliers (~30 actifs)
- Géomètres (en complément de leurs relevés)
- Particuliers investisseurs (via upsell KCI)

## Produits livrés dans ce dossier

### 01 — Application interactive (topo3d-app.html)
Application web complète avec :
- Carte 3D interactive de la Guadeloupe (MapLibre + terrain AWS)
- 4 modes de sélection : clic carte, référence cadastrale, adresse, GPS
- 7 couches commutables : cadastre IGN, bâtiments 3D, orthophoto, hillshade, courbes de niveau, hydrographie, zones de risques
- 6 styles de fond : Topo, Satellite, Sombre, Clair, Terrain, Neutre
- Contrôles caméra : exagération relief, inclinaison, lumière, rotation auto
- Sidebar rétractable + pricing intégré

### 02 — Landing page commerciale (landing-topo3d.html)
Page de vente complète avec :
- Hero + proposition de valeur
- Pain points (coût, délai, format)
- Workflow en 3 étapes
- Livrables détaillés (OBJ, DXF, GeoJSON, PDF)
- Compatibilité logiciels (SketchUp, AutoCAD, Revit, Blender, Rhino, QGIS)
- 3 offres tarifaires + témoignages + FAQ
- CTA avec email pré-rempli

### 03 — Visualiseur 3D overview (guadeloupe-3d-topo.html)
Vue 3D panoramique de toute la Guadeloupe avec POI, navigation rapide, et sources de données documentées.

### 04 — Skill Claude (topo-3d-parcelle.skill)
Skill installable dans Claude / Cowork pour générer automatiquement les fichiers 3D via commande conversationnelle. Orchestre les APIs IGN et produit les livrables.

### 05 — Demo Output (Baie-Mahault AB 0001)
Résultat réel d'une génération de test :
- `terrain.obj` — 2 816 vertices, 5 418 triangles (152 Ko)
- `courbes_niveau.dxf` — 21 courbes de niveau, format AutoCAD R12 (743 Ko)
- `parcelle_contour.geojson` — Contour cadastral exact
- `rapport.md` — Rapport technique récapitulatif
- `metadata.json` — Métadonnées de recalage GPS

### 06 — Scripts
- `generate_terrain.py` — Script Python principal (collecte IGN + génération OBJ/DXF)
- `SKILL.md` — Instructions complètes du skill

## Stack technique

| Composant | Technologie |
|---|---|
| Front-end | HTML/CSS/JS vanilla (single-file, zéro build) |
| Carte 3D | MapLibre GL JS + terrain tiles AWS Terrarium |
| Cadastre | API Carto IGN (apicarto.ign.fr) |
| Élévation | API Altimétrie IGN RGE ALTI (data.geopf.fr) |
| Géocodage | API Adresse data.gouv.fr |
| Couches WMS | IGN Géoplateforme (cadastre, ortho, courbes, hydro) |
| Bâtiments 3D | OpenMapTiles vector tiles (Stadia Maps) |
| Génération 3D | Python (numpy, scipy, matplotlib) |
| Format OBJ | Wavefront OBJ avec coordonnées locales en mètres |
| Format DXF | AutoCAD R12 (AC1009), multi-layers |

## Modèle tarifaire

| Offre | Prix | Contenu |
|---|---|---|
| **Essentiel** | 49€ / parcelle | Mesh OBJ (5m) + contour GeoJSON |
| **Complet** ⭐ | 99€ / parcelle | OBJ (2-3m) + DXF courbes + rapport technique |
| **Pro Illimité** | 249€ / mois | Tout illimité, résolution max, accès API, support |

## Précision des données

| Source | Précision verticale | Résolution |
|---|---|---|
| IGN RGE ALTI LiDAR HD | ±0.2 m | Maille 1 m |
| IGN RGE ALTI photogrammétrie | ±1 m | Maille 5 m |
| SRTM NASA (fallback) | ±5-10 m | 30 m |
| Cadastre PCI Express | ±0.5-2 m planimétrique | — |

## Synergies avec KCI

Topo3D s'intègre dans l'écosystème KCI (Karukera Conseil Immobilier) :
- **Upsell** : proposé dans les rapports KCI Complète (129€) et Premium (299€)
- **Lead gen** : les utilisateurs Topo3D sont des prospects naturels pour les analyses de faisabilité KCI
- **Crédibilité** : renforce le positionnement de KCI comme référence technique en immobilier Guadeloupe

## Prochaines étapes

1. **Déployer sur Vercel** — Hébergement de l'application + landing page
2. **Intégrer Stripe** — Paiement en ligne automatisé
3. **Automatiser la livraison** — Webhook post-paiement → génération → envoi email
4. **Campagne de lancement** — Emailing ciblé aux cabinets d'architecture 971
5. **SEO local** — Articles blog ImmoServices971 sur la topographie en Guadeloupe

---

*Projet développé par Dereck Rauzduel — KCI (Karukera Conseil Immobilier)*
*Mars 2026*
