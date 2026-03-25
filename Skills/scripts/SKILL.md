---
name: topo-3d-parcelle
description: >
  Générateur de fichiers 3D topographiques exploitables (.OBJ, .DXF) à partir d'une parcelle cadastrale en Guadeloupe.
  Utilise ce skill dès qu'un utilisateur veut : générer un terrain 3D, obtenir la topographie d'une parcelle, exporter un MNT en fichier 3D,
  créer un modèle de terrain numérique, produire un fichier OBJ ou DXF à partir de données d'élévation, ou préparer un relevé topographique
  pour un architecte ou bureau d'études. S'applique aussi quand l'utilisateur mentionne "topo 3D", "mesh terrain", "relief parcelle",
  "modèle numérique de terrain", "courbes de niveau 3D", "export topographie", "fichier 3D terrain", ou toute demande liée à la génération
  de données topographiques exploitables en CAO/BIM (SketchUp, AutoCAD, Revit, Blender). Couvre la Guadeloupe (971) et potentiellement
  toute la France via les APIs IGN. Même si l'utilisateur ne dit pas explicitement "3D" mais parle d'un terrain, d'une parcelle à modéliser,
  ou de données altimétriques à exploiter, ce skill est le bon choix.
---

# Topo 3D Parcelle — Générateur de terrain 3D pour architectes

## Objectif

Ce skill transforme une parcelle cadastrale en un fichier 3D exploitable (.OBJ + .DXF) avec courbes de niveau, destiné aux architectes et bureaux d'études en Guadeloupe. L'outil produit un livrable professionnel prêt à importer dans SketchUp, AutoCAD, Revit ou Blender.

## Public cible

Architectes, géomètres, bureaux d'études techniques (BET), promoteurs immobiliers, urbanistes — principalement en Guadeloupe (971) mais le workflow fonctionne sur toute la France métropolitaine et les DOM-TOM couverts par l'IGN.

## Workflow général

```
Entrée utilisateur (parcelle)
    ↓
1. Identifier la parcelle (cadastre IGN)
    ↓
2. Récupérer le contour GeoJSON
    ↓
3. Collecter les données d'élévation (grille de points)
    ↓
4. Générer le mesh 3D (.OBJ)
    ↓
5. Générer les courbes de niveau (.DXF)
    ↓
6. Livrer les fichiers + rapport récapitulatif
```

## Étape 1 — Identifier la parcelle

L'utilisateur peut fournir l'un des trois formats d'entrée suivants. Le script doit les détecter automatiquement :

### Format A : Référence cadastrale
Exemples : `971 AB 0123`, `971-AB-123`, `Baie-Mahault AB 45`
→ Extraire : code_dep (971), code_com (INSEE), section (AB), numero (0123)

### Format B : Adresse postale
Exemples : `12 rue de la Liberté, 97122 Baie-Mahault`
→ Géocoder via l'API Adresse IGN puis chercher la parcelle intersectante

### Format C : Coordonnées GPS + rayon
Exemples : `16.0445, -61.6642, rayon 200m` ou `lat 16.0445 lng -61.6642`
→ Construire un buffer circulaire et récupérer les parcelles intersectantes

### APIs à utiliser

**Géocodage (adresse → coordonnées) :**
```
GET https://api-adresse.data.gouv.fr/search/?q={adresse}&limit=1
```
Retourne un GeoJSON FeatureCollection avec les coordonnées.

**Cadastre (parcelle → contour GeoJSON) :**
```
GET https://apicarto.ign.fr/api/cadastre/parcelle
  ?code_dep=971
  &code_com={code_insee_5chars}
  &section={section}
  &numero={numero}
```
Ou par géométrie :
```
POST https://apicarto.ign.fr/api/cadastre/parcelle
Content-Type: application/json
{ "geom": { "type": "Point", "coordinates": [lng, lat] } }
```
Retourne un GeoJSON avec le contour exact de la parcelle.

**Important :** Les codes INSEE Guadeloupe commencent par 971XX. Le code_com est le code INSEE complet à 5 caractères (ex: 97105 pour Baie-Mahault). La section est 2 caractères, le numéro est 0-padded à 4 chiffres.

## Étape 2 — Collecter les données d'élévation

Une fois le contour de la parcelle obtenu (bbox), collecter une grille de points d'altitude.

**API Altimétrie IGN (gratuite, haute résolution) :**
```
GET https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json
  ?lon={lng1}|{lng2}|...
  &lat={lat1}|{lat2}|...
  &resource=ign_rge_alti_wld
  &zonly=false
```

Le paramètre `resource` contrôle la source de données :
- `ign_rge_alti_wld` : RGE ALTI (1-5m de résolution, la meilleure qualité)

Limites : maximum ~200 points par requête. Pour une parcelle moyenne, il faudra entre 5 et 50 requêtes selon la résolution souhaitée.

**Stratégie de grille :**
1. Calculer la bounding box du contour de parcelle
2. Ajouter un buffer de 20m autour (pour le contexte terrain)
3. Créer une grille régulière avec un pas de 2-5m (selon la taille de la parcelle)
4. Envoyer les points par lots de 100-200 à l'API
5. Filtrer les points qui sont dans le contour + buffer

**Résolution recommandée :**
- Parcelle < 1 000 m² : pas de 2m (~250 points)
- Parcelle 1 000 - 5 000 m² : pas de 3m (~500 points)
- Parcelle > 5 000 m² : pas de 5m (~500-1000 points)

## Étape 3 — Générer le mesh 3D (.OBJ)

Le script `scripts/generate_terrain.py` gère toute la chaîne de génération. Il utilise numpy pour le maillage et produit un fichier .OBJ standard.

**Structure du fichier OBJ :**
```
# Terrain 3D — Parcelle 971 AB 0123
# Généré par Topo3D Parcelle — KCI
# Date: 2026-03-18
# Résolution: 3m | Points: 487 | Triangles: 924

# Vertices (x=est, y=nord, z=altitude en mètres)
v 0.000 0.000 12.340
v 3.000 0.000 12.560
...

# Faces (triangles)
f 1 2 102
f 2 102 103
...
```

**Coordonnées :** Utiliser un système local centré sur le coin SW de la bbox. L'axe X = Est, Y = Nord, Z = Altitude. Inclure un commentaire avec les coordonnées GPS d'origine pour le recalage.

**Maillage :** Triangulation de Delaunay sur la grille régulière, puis suppression des triangles dont le centroïde est hors du contour + buffer.

## Étape 4 — Générer les courbes de niveau (.DXF)

Produire un fichier DXF avec les courbes de niveau (isohypses) à intervalles réguliers.

**Intervalles recommandés :**
- Terrain plat (dénivelé < 5m) : courbes tous les 0.5m
- Terrain modéré (5-20m) : courbes tous les 1m
- Terrain pentu (> 20m) : courbes tous les 2m, maîtresses tous les 10m

Le DXF doit contenir :
- Un layer `CONTOURS_MINEURES` pour les courbes normales (couleur grise, trait fin)
- Un layer `CONTOURS_MAJEURES` pour les courbes maîtresses (couleur noire, trait épais, cotées)
- Un layer `PARCELLE` avec le contour de la parcelle
- Un layer `POINTS_COTES` avec les points d'altitude échantillonnés

**Format DXF :** Utiliser le format R12 (AC1009) pour la compatibilité maximale avec AutoCAD et les logiciels CAO.

## Étape 5 — Livrer les fichiers

Produire les fichiers suivants dans le dossier de sortie :

```
{nom_parcelle}_topo3d/
├── terrain.obj              # Mesh 3D du terrain
├── terrain.mtl              # Matériau (optionnel, couleur terre)
├── courbes_niveau.dxf       # Courbes de niveau AutoCAD
├── parcelle_contour.geojson # Contour original de la parcelle
├── rapport.md               # Rapport récapitulatif
└── metadata.json            # Métadonnées techniques
```

**Rapport récapitulatif (rapport.md) :**
```markdown
# Rapport Topographique 3D
## Parcelle {référence}
- Commune : {commune}, Guadeloupe
- Surface : {surface} m²
- Altitude min : {z_min} m | max : {z_max} m
- Dénivelé : {delta_z} m
- Pente moyenne : {pente}%
- Résolution grille : {pas}m
- Points d'altitude : {nb_points}
- Triangles mesh : {nb_triangles}
- Source DEM : IGN RGE ALTI (résolution 1-5m)

## Fichiers produits
- `terrain.obj` — Mesh 3D importable SketchUp/Blender/Revit
- `courbes_niveau.dxf` — Courbes de niveau AutoCAD R12
- `parcelle_contour.geojson` — Contour parcelle
```

## Script principal

Le script `scripts/generate_terrain.py` orchestre tout le processus. Lire ce script et l'exécuter avec les paramètres de l'utilisateur.

**Usage :**
```bash
python scripts/generate_terrain.py \
  --input "971 AB 0123" \
  --output /chemin/vers/sortie/ \
  --resolution 3 \
  --contour-interval 1
```

Le script accepte aussi `--input "16.0445,-61.6642,200"` (coords+rayon) ou `--input "12 rue de la Liberté, 97122 Baie-Mahault"` (adresse).

## Dépendances Python

```bash
pip install numpy requests scipy --break-system-packages
```

Pas de dépendance lourde — numpy pour les calculs, requests pour les APIs, scipy pour la triangulation de Delaunay et les courbes de niveau (contour).

## Gestion des erreurs

- Si l'API cadastre ne trouve pas la parcelle → message clair avec suggestions (vérifier le code INSEE, la section)
- Si l'API altimétrie retourne des valeurs nulles → interpoler à partir des voisins ou signaler les trous
- Si la parcelle est trop grande (> 50 000 m²) → augmenter le pas de grille automatiquement et prévenir l'utilisateur
- Si la connexion échoue → retry 3 fois avec backoff exponentiel

## Exemple d'utilisation

**Utilisateur :** "Génère-moi le terrain 3D de la parcelle AB 45 à Baie-Mahault"
→ Le skill détecte : code_dep=971 (Guadeloupe par défaut), commune=Baie-Mahault (INSEE 97105), section=AB, numero=0045
→ Appelle l'API cadastre pour le contour
→ Collecte l'élévation via l'API altimétrie IGN
→ Génère terrain.obj + courbes_niveau.dxf
→ Produit le rapport et livre les fichiers

**Utilisateur :** "J'ai un terrain au 25 chemin des Palmistes, Petit-Bourg, fais-moi la topo en 3D"
→ Géocode l'adresse via api-adresse.data.gouv.fr
→ Cherche la parcelle intersectante via l'API cadastre POST
→ Suite identique
