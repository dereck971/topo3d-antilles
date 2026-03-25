# Session Cowork — Topo3D Guadeloupe Validation
## Date: 19 mars 2026
## Statut: SCRIPTS PRÊTS — EN ATTENTE D'EXÉCUTION

---

## Ce qui a été fait

### 1. Recherche LiDAR HD
- Trouvé les liens de téléchargement des données LiDAR HD IGN pour la Guadeloupe
- Acquisitions LiDAR HD terminées (opérateur Sintegra)
- 4 produits disponibles : nuages de points (.LAZ), MNT, MNS, MNH
- Tous gratuits (licence Etalab 2.0)

### 2. Mise à jour du skill topo-3d-parcelle
- Fichiers mis à jour dans `topo-3d-parcelle-update/` (SKILL.md + generate_terrain.py)
- Ajout section LiDAR HD avec liens + tableau comparatif API vs LiDAR brut
- Rapport généré enrichi avec liens téléchargement LiDAR
- Metadata.json enrichie avec sources LiDAR
- **À FAIRE** : copier `topo-3d-parcelle-update/` dans `.skills/skills/topo-3d-parcelle/` (filesystem skills en lecture seule)

### 3. Scripts de validation créés
Tous dans `Topo3D-Guadeloupe-Validation/` :

| Script | Rôle |
|---|---|
| `01-batch_generate_50.py` | Génère 50 extraits topo sur toutes les communes de Guadeloupe |
| `02-select_by_zone.py` | Sélecteur CLI par commune / bbox / rayon / statut |
| `03-carte_interactive.html` | Carte Leaflet avec les 50 points, filtres, dessin de zone |
| `04-verify_and_report.py` | Vérifie tous les fichiers et produit un rapport Markdown |

### 4. Fonctionnalités implémentées

#### Extraction des arbres (layer séparé)
- Le DXF contient 6 layers au lieu de 4 :
  - `CONTOURS_MINEURES` — courbes de niveau normales
  - `CONTOURS_MAJEURES` — courbes maîtresses
  - `PARCELLE` — contour cadastral
  - `POINTS_COTES` — points d'altitude
  - **`VEGETATION_ARBRES`** — position + hauteur de chaque arbre détecté (vert)
  - **`VEGETATION_CANOPEE`** — cercles de canopée estimés (vert clair)
- Méthode : différence MNS - MNT = hauteur végétation, filtrage > 2m pour les arbres
- Note : actuellement MNS et MNT utilisent la même API (ign_rge_alti_wld), donc la détection d'arbres sera à 0. Quand l'API MNS LiDAR HD sera disponible, il suffira de changer le `resource` dans le script.

#### Sélection par zone
- **Carte HTML** : filtre par commune, statut, dénivelé + dessin de rectangle sur la carte
- **Script CLI** : `--commune`, `--bbox`, `--radius`, `--status`, `--min-denivele`, `--min-trees`

#### 50 points de test
- Répartis sur : Grande-Terre (15), Basse-Terre côte sous le vent (16), Basse-Terre côte au vent (9), Hauteurs (3), Les Saintes (2), Marie-Galante (3), Port-Louis (2)
- Couvrent toutes les communes principales de Guadeloupe

---

## À FAIRE à la prochaine session

### Étape 1 : Installer les dépendances
```bash
pip install numpy requests scipy matplotlib --break-system-packages
```

### Étape 2 : Lancer la génération des 50 extraits
```bash
cd "/chemin/vers/BATI-DOC Guadeloupe/Topo3D-Guadeloupe-Validation"
python 01-batch_generate_50.py --output ./extraits/ --max 50
```
Durée estimée : ~30-60 min (API IGN + ~500 requêtes d'altitude)
Le script sauve un index.json tous les 5 extraits (reprise possible avec `--start N`)

### Étape 3 : Vérifier les fichiers
```bash
python 04-verify_and_report.py --input ./extraits/ --output rapport_validation.md
```

### Étape 4 : Tester la sélection par zone
```bash
# Par commune
python 02-select_by_zone.py --index extraits/index.json --commune "Baie-Mahault"

# Par bbox (Basse-Terre sud)
python 02-select_by_zone.py --index extraits/index.json --bbox 15.9,-61.8,16.1,-61.6

# Par rayon autour de Pointe-à-Pitre (5km)
python 02-select_by_zone.py --index extraits/index.json --radius 16.241,-61.534,5
```

### Étape 5 : Ouvrir la carte interactive
```bash
# Servir le dossier localement (la carte charge extraits/index.json)
cd "/chemin/vers/BATI-DOC Guadeloupe/Topo3D-Guadeloupe-Validation"
python -m http.server 8080
# Ouvrir http://localhost:8080/03-carte_interactive.html
```

### Étape 6 : Copier le skill mis à jour
```bash
cp -r "topo-3d-parcelle-update/"* ".skills/skills/topo-3d-parcelle/"
```

---

## Liens LiDAR HD utiles
- Nuages de points : https://cartes.gouv.fr/telechargement/IGNF_NUAGES-DE-POINTS-LIDAR-HD
- MNT : https://cartes.gouv.fr/telechargement/IGNF_MNT-LIDAR-HD
- MNS : https://cartes.gouv.fr/telechargement/IGNF_MNS-LIDAR-HD
- MNH : https://cartes.gouv.fr/telechargement/IGNF_MNH-LIDAR-HD
- Doc IGN : https://geoservices.ign.fr/lidarhd
- Data.gouv : https://www.data.gouv.fr/datasets/nuages-de-points-lidar-hd

---

## Raison du blocage actuel
Le disque interne de la VM Cowork était saturé (0 bytes libres). Bash ne pouvait plus créer de fichiers temporaires (`mkdir ENOSPC`). Les scripts ont été écrits directement sur le dossier monté (disque utilisateur) via l'outil Write. Il faut une nouvelle session pour exécuter.
