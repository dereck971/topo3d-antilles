---
name: masse-batiment-3d
description: "Generateur de rendus architecturaux pour projets immobiliers en Guadeloupe via Gemini. Produit des visuels professionnels de masses batiment (bungalows, villas, collectifs, mini-resorts) integres sur leur terrain avec contraintes PLU reelles. 3 styles valides : maquette blanche, esquisse graphite, photorealiste. Utilise ce skill des que l'utilisateur veut visualiser un projet de construction, generer un rendu architectural, creer une esquisse de faisabilite visuelle, produire un visuel pour un rapport KCI, ou montrer a un client ce qu'on peut construire sur un terrain. Declencheurs : rendu, esquisse, visuel 3D, masse batiment, simulation volumetrique, perspective architecturale, photorealiste, maquette blanche, image du projet, ou toute demande de visualisation de construction. Complement visuel des skills kci-rapport et topo-3d-parcelle."
---

# Skill : Masse Bâtiment 3D — Rendus Architecturaux via Gemini

## Vue d'ensemble

Ce skill génère des rendus architecturaux professionnels pour des projets de construction en Guadeloupe. Il utilise Gemini (génération d'images) avec des prompts paramétriques calibrés sur les données PLU réelles de la base de données KCI.

Trois styles de rendu sont disponibles, chacun validé et verrouillé :

| Style | Usage | Offre KCI |
|-------|-------|-----------|
| **Maquette blanche (clay render)** | Rendu 3D tout blanc type clay/ambient occlusion, terrain LISSE, esthétique digitale moderne | Premium 299€ |
| **Esquisse graphite** | Crayon monochrome sur papier blanc, dessin d'architecte fait main | Complète 129€ |
| **Photoréaliste** | Photo drone simulée, lumière golden hour, végétation réelle | Premium 299€ (variante) |

## Pipeline d'intégration

```
Parcelle cadastrale + Photos drone (optionnel)
    ↓
[topo-3d-parcelle] → données terrain, relief
    ↓
[masse-batiment-3d] ← CE SKILL
    → Lit contraintes PLU depuis fiche commune JSON
    → Analyse photos drone si disponibles (végétation, bâti existant, rivière, route)
    → Compose le prompt Gemini paramétrique
    → Génère le rendu via Gemini (navigateur ou API)
    → Produit : image PNG haute résolution
    ↓
[kci-rapport] → Intègre le rendu dans le PDF
    → Section "Simulation volumétrique"
```

## Étape 1 — Collecter les informations

Rassembler ces données (demander à l'utilisateur ce qui manque) :

| Information | Source | Obligatoire |
|------------|--------|-------------|
| Commune | Utilisateur | OUI |
| Type de bâtiment | Utilisateur | OUI |
| Surface habitable (m²) | Utilisateur | OUI |
| Nombre d'unités (si multi) | Utilisateur | OUI si multi |
| Photos drone du site | Utilisateur (dossier DRONE) | NON mais recommandé |
| Bâti existant sur parcelle | Photos drone ou utilisateur | NON |
| Éléments naturels (rivière, etc.) | Photos drone ou utilisateur | NON |

## Étape 2 — Charger la fiche commune

Lire la fiche JSON de la commune :
```
/mnt/ANALYSE IMMO APP/references/database/guadeloupe/communes/{commune-slug}.json
```

Extraire :
- `urbanisme_plu.zones_reglementaires` → hauteur max, CES, reculs, toiture
- `marche_dvf` → prix au m² pour contextualisation
- Contexte géographique → type de terrain, végétation typique

## Étape 3 — Analyser les photos drone (si disponibles)

Si l'utilisateur a un dossier avec des photos drone du site :
1. Lire 3-5 photos JPG (vues aériennes de préférence)
2. Identifier : bâtiment(s) existant(s), type de végétation, présence d'eau/rivière, routes, voisinage, pente du terrain
3. Intégrer ces éléments réels dans le prompt Gemini

C'est ce qui rend les rendus crédibles — ils reflètent le vrai site, pas un terrain générique.

## Étape 4 — Composer le prompt Gemini

Choisir le style selon l'offre KCI et composer le prompt. Lire `references/prompts-valides.md` pour les 3 templates complets.

### Style 1 : Maquette blanche — Clay Render (défaut Premium)

**IMPORTANT** : Ce style produit un rendu 3D "clay render" tout blanc, PAS une maquette en carton avec des couches empilées. Le terrain doit être COMPLÈTEMENT LISSE — aucune courbe de niveau, aucun trait de parcelle.

Prompt validé (mini-resort) :
```
Generate a clean white 3D architectural visualization render — NOT a cardboard maquette, but a smooth 3D rendering that looks like a Blender/SketchUp white clay render. {nb_unites} tropical {type_batiment} ({surface}sqm each, on wooden stilts, hip roofs) arranged around a round pool. Coconut palms and tropical shrubs. The terrain is a COMPLETELY SMOOTH sloping hillside — pure smooth white surface like a 3D mesh render, NO contour lines, NO paths drawn on surface, NO boundary outlines. {denivele}m elevation change. Everything is monochrome white/light gray like an ambient occlusion render. Soft global illumination, subtle shadows for depth. Clean rectangular base. The aesthetic should feel like a modern 3D architectural visualization preview — crisp, digital, elegant — not like a physical foam board model. Light gray gradient background. Isometric-like camera angle.
```

Prompt validé (bâtiment unique) :
```
Generate a clean white 3D architectural visualization render — NOT a cardboard maquette, but a smooth 3D rendering that looks like a Blender/SketchUp white clay render. A {type_batiment} ({surface}sqm, on wooden stilts, {toiture}) on a COMPLETELY SMOOTH sloping hillside in {commune}, Guadeloupe. Pure smooth white surface, NO contour lines, NO topographic markings, NO boundary outlines. Everything monochrome white/light gray like an ambient occlusion render. Coconut palms and tropical shrubs. Soft global illumination, subtle shadows. Clean rectangular base. Modern 3D visualization aesthetic — crisp, digital, elegant. Light gray gradient background. Isometric-like camera angle.
```

### Style 2 : Esquisse graphite

Prompt type :
```
Generate an architectural sketch render of a {type_batiment} ({surface}sqm) on a {terrain} plot in {commune}, Guadeloupe, Caribbean. Style: pencil sketch on white paper, monochrome graphite, no colors. The {type_batiment} has a {forme} with a {toiture}, a covered wooden terrace with pergola, and tropical vegetation ({vegetation}). The terrain shows {terrain_detail}. Include construction setback lines (dashed). Bird's eye perspective view at 45 degrees. Professional architectural presentation quality, clean minimalist lines, white background. The render should look like a hand-drawn architect's concept sketch.
```

### Style 3 : Photoréaliste

**IMPORTANT** : Le terrain doit aussi être LISSE — pas de courbes de niveau. Herbe verte naturelle, végétation tropicale réaliste. Golden hour caribéenne.

Prompt validé (mini-resort) :
```
Generate a PHOTOREALISTIC aerial architectural render of {nb_unites} tropical {type_batiment} ({surface}sqm each, on dark wooden stilts, white corrugated metal hip roofs, open terraces with wooden railings) arranged in an arc on a lush green tropical hillside around a small round turquoise swimming pool with wooden deck. 8-10 tall coconut palms, tropical shrubs (hibiscus, bougainvillea, ferns), green grass covering the COMPLETELY SMOOTH sloping terrain — NO contour lines, NO topographic markings, just natural green hillside. {denivele}m elevation change, inspired by {commune} Guadeloupe volcanic slopes. Warm golden hour Caribbean sunlight, realistic materials (wood, metal roofing, concrete foundations, blue pool water). A gravel path winds between the bungalows. The scene sits on a clean rectangular base showing the terrain cross-section. Drone photography angle, shallow depth of field, cinematic lighting. Photorealistic architectural visualization quality.
```

Prompt validé (avec photos drone — personnaliser description site) :
```
Generate a photorealistic aerial drone photograph of {projet_description} on a plot in {commune}, Guadeloupe, Caribbean. {description_site_detaillee_depuis_photos_drone}. {description_projet_avec_PLU}. The terrain is COMPLETELY SMOOTH with natural vegetation — NO contour lines or topographic markings. {atmosphere}. Drone at {altitude}m, {angle} degrees, wide angle. Professional real estate photography. Hyperrealistic.
```

Pour le style photoréaliste, si des photos drone sont disponibles, la description du site doit être extrêmement précise. Décrire : la forme du terrain (pente, plat), la végétation spécifique (espèces, densité, emplacement), les structures existantes (matériaux, état, toit), les éléments d'eau (rivière, direction, rochers), les voies d'accès (route, chemin), et le contexte autour (forêt, collines, voisins).

## Étape 5 — Générer le rendu

Ouvrir https://gemini.google.com dans le navigateur, coller le prompt composé, attendre ~20-30 secondes la génération. Télécharger l'image PNG.

Pour l'automatisation future : utiliser l'API Gemini Imagen avec une clé API Google AI Studio.

## Étape 6 — Livrer

- Sauvegarder l'image dans le dossier projet
- Si intégration KCI : passer au skill `kci-rapport` pour inclusion dans la section "Simulation volumétrique"

## Variantes par zone géographique

| Zone | Terrain | Végétation | Orientation |
|------|---------|-----------|-------------|
| Littoral sud (Ste-Anne, Le Gosier, St-François) | Plat/légère pente côtière, mer en fond | Cocotiers, raisins de mer, bougainvilliers | Sud |
| Plaine (Baie-Mahault, Les Abymes) | Plat, canaux drainage, mangrove au loin | Palmiers royaux, manguiers | Sud-ouest |
| Relief Basse-Terre (BT, Gourbeyre, St-Claude) | Pente volcanique forte, végétation dense | Forêt tropicale, fougères arborescentes, bananiers | Ouest |
| Nord Grande-Terre (Le Moule, Anse-Bertrand) | Plateau calcaire, affleurements rocheux | Arbres couchés par le vent, canne à sucre | Sud-ouest |
| Vallées rivières (Goyave, Capesterre) | Pente douce vers rivière, rochers volcaniques | Cocotiers, bananiers, fougères géantes, héliconia | Variable |

## Variantes par type de bâtiment

| Type | Forme | Toiture | Ajouts |
|------|-------|---------|--------|
| Bungalow 20m² (gîte) | Rectangle compact sur pilotis | 2 pentes tôle, larges débords | Escalier bois |
| Bungalow 30-40m² (T2 tourisme) | Rectangle avec terrasse couverte | 2 pentes tôle ondulée | Petite piscine à proximité |
| Villa 150m² (T4 R+1) | L en R+1 | 4 pentes hip roof tôle rouge | Carport 2 véhicules, piscine, mur de clôture |
| Mini-resort 3-6 bungalows | Bungalows dispersés en arc | Toits 2 pentes assortis | Piscine centrale, pergola repas, chemins gravier |
| Petit collectif R+1 (6 logements) | Rectangle R+1, coursives extérieures | Toit terrasse + panneaux solaires | Parking RDC, jardin commun |

## Paramètres de style fixes

Ces paramètres sont verrouillés pour chaque style et ne doivent pas être modifiés :

**Maquette blanche (clay render) :**
- Palette : blanc pur, gris clair uniquement — AUCUNE couleur (pas de bleu piscine, pas de bois marron, pas de vert)
- Terrain : LISSE — surface courbe continue, zéro courbe de niveau, zéro trait de parcelle
- Éclairage : global illumination douce, ombres subtiles pour la profondeur
- Fond : dégradé gris clair
- Esthétique : "Blender/SketchUp clay render meets ambient occlusion" — digital, crisp, élégant
- Vue : isométrique ~45°
- Base : rectangulaire blanche, montrant la coupe du terrain

**Esquisse graphite :**
- Palette : monochrome graphite, pas de couleurs
- Support : papier blanc
- Lignes : fines, minimalistes, propres
- Éléments techniques : reculs PLU en pointillés, courbes de niveau terrain
- Vue : bird's eye 45°

**Photoréaliste :**
- Qualité : photo drone professionnelle, immobilier investisseur
- Terrain : LISSE — herbe verte naturelle, pas de courbes de niveau
- Lumière : golden hour caribéenne, chaleur tropicale
- Matériaux : bois foncé, tôle ondulée blanche, béton, eau turquoise
- Végétation : cocotiers, hibiscus, bougainvilliers, fougères
- Détails : basés sur observations réelles du site (photos drone si dispo)
- Base : rectangulaire montrant la coupe du terrain
- Vue : drone ~40m, 45°, grand angle, profondeur de champ

## Calibrage offres KCI

| Offre | Rendu inclus | Style |
|-------|-------------|-------|
| Essentielle 49€ | Aucun | — |
| Complète 129€ | 1 rendu | Esquisse graphite |
| Premium 299€ | 2 rendus | Maquette blanche + Photoréaliste (si photos drone dispo) |

## Dépendances

- Accès à Gemini (navigateur ou API)
- Base de données communes JSON dans `/mnt/ANALYSE IMMO APP/references/database/guadeloupe/communes/`
- Optionnel : photos drone du site (dossier DRONE)
- Optionnel : skill `topo-3d-parcelle` pour données terrain
- Optionnel : skill `kci-rapport` pour intégration rapport PDF
