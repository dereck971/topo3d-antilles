# Topo3D Guadeloupe — Validation du workflow

Génération et validation de 50 extraits topographiques 3D répartis sur toute la Guadeloupe.

## Installation

```bash
pip install numpy requests scipy matplotlib --break-system-packages
```

## Usage rapide

```bash
# 1. Générer les 50 extraits (≈30-60 min)
python 01-batch_generate_50.py --output ./extraits/

# 2. Sélectionner par zone
python 02-select_by_zone.py --index extraits/index.json --commune "Baie-Mahault"
python 02-select_by_zone.py --index extraits/index.json --bbox 15.9,-61.8,16.1,-61.6

# 3. Vérifier et analyser
python 04-verify_and_report.py --input ./extraits/ --output rapport_validation.md

# 4. Carte interactive
python -m http.server 8080
# Ouvrir http://localhost:8080/03-carte_interactive.html
```

## Structure des fichiers générés

```
extraits/
├── index.json                    # Index consolidé des 50 extraits
├── 01_Les_Abymes_centre/
│   ├── terrain.obj               # Mesh 3D
│   ├── terrain.mtl               # Matériau
│   ├── courbes_niveau.dxf        # DXF avec 6 layers dont VEGETATION
│   ├── parcelle_contour.geojson  # Contour cadastral
│   └── metadata.json             # Métadonnées + infos végétation
├── 02_Pointe_a_Pitre_centre/
│   └── ...
└── 50_Port_Louis_Souffleur/
    └── ...
```

## Layers DXF

| Layer | Contenu | Couleur |
|---|---|---|
| CONTOURS_MINEURES | Courbes de niveau | Gris |
| CONTOURS_MAJEURES | Courbes maîtresses | Noir |
| PARCELLE | Contour cadastral | Rouge |
| POINTS_COTES | Points d'altitude | Vert foncé |
| **VEGETATION_ARBRES** | Points + hauteur des arbres | **Vert** |
| **VEGETATION_CANOPEE** | Cercles de canopée estimés | **Vert clair** |
