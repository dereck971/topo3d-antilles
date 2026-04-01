# PROMPT CLAUDE CODE — Intégration couche LiDAR HD IGN sur Topo3D Antilles

## Contexte

Topo3D Antilles (www.topo3d-antilles.com) est une plateforme de topographie 3D interactive pour les DOM (Guadeloupe, Martinique, Guyane, Réunion). Le produit principal est `carte.html` + `carte.js` : une carte MapLibre GL avec terrain 3D, couches cadastre/ortho/hillshade/réglementation, et export 3D (OBJ, DXF).

Actuellement l'élévation provient de :
- **Rendu terrain** : tuiles Terrarium AWS (`s3.amazonaws.com/elevation-tiles-prod/terrarium`) avec exagération 1.5x
- **Données d'altitude** (exports) : API IGN RGE ALTI (`data.geopf.fr/altimetrie`) avec resource `ign_rge_alti_wld`, grille 5m, batches de 150 points — cf. `_lib/elevation.js`

Le programme **LiDAR HD de l'IGN** couvre désormais la Guadeloupe (acquis par Sintegra) et met à disposition gratuitement via la Géoplateforme des MNT/MNS/MNH à résolution 1m et des nuages de points classifiés en COPC.

## Objectif

Ajouter **3 couches LiDAR HD** dans le panneau "Couches de Base" de `carte.html` et les câbler dans `carte.js`, puis upgrader le pipeline d'élévation pour utiliser les données LiDAR HD à la place du RGE ALTI world.

## Tâche 1 — Couches visuelles WMTS (carte.js + carte.html)

### 1.1 Ajouter 3 sources + layers dans `addCustomLayers()` de `carte.js`

Après le bloc `// Hillshade` (ligne ~112), ajouter :

```javascript
// ─── LiDAR HD IGN ───

// MNT LiDAR HD — Ombrage du relief (sol nu)
if(!map.getSource('lidar-mnt-src')){
    map.addSource('lidar-mnt-src',{type:'raster',tiles:['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW.LIDAR.HD&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png&STYLE=normal'],tileSize:256,maxzoom:18});
    map.addLayer({id:'lidar-mnt',type:'raster',source:'lidar-mnt-src',paint:{'raster-opacity':0.65},layout:{visibility:'none'}});
}

// MNS LiDAR HD — Ombrage du sursol (végétation + bâti)
if(!map.getSource('lidar-mns-src')){
    map.addSource('lidar-mns-src',{type:'raster',tiles:['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW.LIDAR.HD.MNS&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png&STYLE=normal'],tileSize:256,maxzoom:18});
    map.addLayer({id:'lidar-mns',type:'raster',source:'lidar-mns-src',paint:{'raster-opacity':0.6},layout:{visibility:'none'}});
}

// MNH LiDAR HD — Hauteur de la végétation/bâti (MNS - MNT)
if(!map.getSource('lidar-mnh-src')){
    map.addSource('lidar-mnh-src',{type:'raster',tiles:['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW.LIDAR.HD.MNH&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png&STYLE=normal'],tileSize:256,maxzoom:18});
    map.addLayer({id:'lidar-mnh',type:'raster',source:'lidar-mnh-src',paint:{'raster-opacity':0.55},layout:{visibility:'none'}});
}
```

### 1.2 Enregistrer dans `layerState` (ligne ~53 de carte.js)

Ajouter les 3 clés dans l'objet `layerState` :
```javascript
'lidar-mnt':false,'lidar-mns':false,'lidar-mnh':false
```

### 1.3 Ajouter les checkboxes dans `carte.html`

Dans le panneau latéral, après la section "Couches de Base" (après la `</div>` de fermeture du `layer-list` ligne ~111), insérer une nouvelle section :

```html
<div class="panel-section">
    <div class="panel-title">LiDAR HD (IGN)</div>
    <div class="layer-list">
        <div class="layer-item">
            <input type="checkbox" class="layer-toggle" id="layer-lidar-mnt" data-layer="lidar-mnt">
            <label class="layer-label" for="layer-lidar-mnt">MNT (sol nu)</label>
        </div>
        <div class="layer-item">
            <input type="checkbox" class="layer-toggle" id="layer-lidar-mns" data-layer="lidar-mns">
            <label class="layer-label" for="layer-lidar-mns">MNS (sursol)</label>
        </div>
        <div class="layer-item">
            <input type="checkbox" class="layer-toggle" id="layer-lidar-mnh" data-layer="lidar-mnh">
            <label class="layer-label" for="layer-lidar-mnh">MNH (hauteurs)</label>
        </div>
    </div>
</div>
```

### 1.4 Câbler le toggle

Vérifier que le système de toggle existant (la boucle `document.querySelectorAll('.layer-toggle')` qui écoute les changements) fonctionne avec les nouveaux data-layer. Le mapping `data-layer → layerId` dans le gestionnaire d'événements doit inclure :
```javascript
'lidar-mnt': 'lidar-mnt',
'lidar-mns': 'lidar-mns',
'lidar-mnh': 'lidar-mnh'
```

Chercher dans `carte.html` ou `carte.js` le listener qui fait le mapping checkbox → toggleLayer() et ajouter ces 3 entrées.

## Tâche 2 — Upgrade du pipeline d'élévation (_lib/elevation.js)

### 2.1 Changer la resource IGN

Dans `_lib/elevation.js` ligne 64, remplacer :
```
resource=ign_rge_alti_wld
```
par :
```
resource=ign_rge_alti_wld_lidarhd
```

> **IMPORTANT** : Vérifier d'abord si cette resource existe sur l'API altimétrie en testant manuellement :
> `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=-61.55&lat=16.25&resource=ign_rge_alti_wld_lidarhd&zonly=true`
>
> Si la resource n'existe pas, utiliser `ign_rge_alti_wld` comme fallback (le MNT RGE ALTI est déjà dérivé du LiDAR HD pour les zones couvertes). Dans ce cas, la vraie amélioration côté export sera de baisser la résolution de grille de 5m à 1m (voir 2.2).

### 2.2 Améliorer la résolution de grille

Le paramètre `resolution` par défaut est 5m. Passer à 1m pour les offres premium :
- Dans `elevation.js`, ajouter un paramètre `hd` optionnel :

```javascript
export async function fetchElevationGrid(bbox, resolution = 5, hd = false) {
  if (hd) resolution = 1; // LiDAR HD mode: 1m grid
  // ... rest unchanged
}
```

- Dans les APIs qui appellent `fetchElevationGrid` (generate-obj.js, compute-runoff.js, fiche-parcelle.js), passer `hd: true` quand l'offre est `complet` ou `premium`.

### 2.3 Fallback

Si l'API LiDAR HD ne couvre pas la zone demandée (ex: Guyane pas encore couverte), le fallback sur `ign_rge_alti_wld` doit être automatique. Implémenter :
```javascript
// Essayer LiDAR HD d'abord
let resource = 'ign_rge_alti_wld_lidarhd';
// ... fetch
// Si 100% des élévations sont null → retry avec ign_rge_alti_wld
```

## Tâche 3 — Vérification des URLs WMTS

Avant d'intégrer, valider que les couches WMTS existent en requêtant le GetCapabilities :
```
https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities
```

Chercher les layers contenant "LIDAR" ou "lidarhd" dans la réponse XML. Les noms exacts des layers peuvent différer de ceux indiqués ci-dessus. **Adapter les noms de layers en conséquence.**

Layers probables (à vérifier) :
- `ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW` (ombrage MNT standard)
- `ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.SHADOW` (ombrage MNT LiDAR HD)
- Les MNS et MNH dérivés LiDAR HD

Si les layers WMTS LiDAR HD ne sont pas disponibles en tuiles, une alternative est d'utiliser le WMS :
```
https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.SHADOW&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true
```

## Contraintes

- **Stack** : HTML/CSS/JS vanilla uniquement, pas de framework
- **Deploy** : Vercel (`cd 02_Topo3D/Site_Web && vercel --prod`)
- **CORS** : Pas de wildcard, whitelist topo3d-antilles.com
- **Fichiers critiques à ne PAS supprimer** : `carte.html`, `carte.js`, `api/*`
- **Performance** : Les couches LiDAR HD sont lourdes. Ajouter un `maxzoom:18` et `minzoom:10` pour éviter les requêtes inutiles aux petits zooms
- **Tests** : Tester sur Guadeloupe (couverture LiDAR HD confirmée) et vérifier le fallback sur Guyane (potentiellement non couverte)

## Ordre d'exécution recommandé

1. Valider les URLs WMTS via GetCapabilities (Tâche 3)
2. Ajouter les couches visuelles (Tâche 1) — victoire rapide visible immédiatement
3. Tester le rendu sur carte.html en local
4. Upgrader le pipeline d'élévation (Tâche 2) — impact sur les exports OBJ/DXF
5. Deploy sur Vercel et valider en production

## Résultat attendu

- 3 nouvelles couches LiDAR HD toggleables dans le panneau de la carte
- Exports 3D en résolution 1m pour les offres premium
- Fallback automatique vers RGE ALTI si LiDAR HD non disponible
- Le claim marketing "Topographie 3D LiDAR HD" devient techniquement vrai
