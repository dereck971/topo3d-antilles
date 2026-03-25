# Rapport Topographique 3D

## Parcelle 97 AB 0001

| Paramètre | Valeur |
|---|---|
| Commune | Baie-Mahault, Guadeloupe |
| Surface cadastrale | 54750 m² |
| Altitude min | -0.7 m |
| Altitude max | 24.1 m |
| Dénivelé | 24.9 m |
| Résolution grille | 10.0 m |
| Points d'altitude | 2816 |
| Triangles mesh | 5418 |
| Courbes de niveau | 21 (intervalle 2.0m) |
| Source DEM | IGN RGE ALTI (résolution 1-5m) |

## Fichiers produits

- **terrain.obj** — Mesh 3D importable dans SketchUp, Blender, Revit, AutoCAD
- **terrain.mtl** — Matériau associé au mesh
- **courbes_niveau.dxf** — Courbes de niveau (format AutoCAD R12)
- **parcelle_contour.geojson** — Contour cadastral de la parcelle
- **rapport.md** — Ce rapport
- **metadata.json** — Métadonnées techniques complètes

## Coordonnées de référence

Le mesh 3D utilise un système de coordonnées locales :
- **Origine** : 16.274412°N, -61.622783°E
- **Axes** : X = Est (mètres), Y = Altitude (mètres), Z = Nord (mètres)
- Pour recaler dans un SIG, utiliser l'origine GPS ci-dessus

## Sources de données

- **Élévation** : [IGN RGE ALTI®](https://geoservices.ign.fr/rgealti) via API Géoplateforme
- **Cadastre** : [API Carto IGN](https://apicarto.ign.fr/api/doc/cadastre) — Parcellaire Express PCI
- **Géocodage** : [API Adresse data.gouv.fr](https://api-adresse.data.gouv.fr/)
- **Précision** : RGE ALTI ±0.2m (LiDAR) à ±1m (photogrammétrie) selon la zone

---
*Généré le 18/03/2026 à 09:25 par Topo3D Parcelle — KCI*
