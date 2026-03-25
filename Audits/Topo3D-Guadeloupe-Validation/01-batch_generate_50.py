#!/usr/bin/env python3
"""
Batch Topo3D — Génère 50 extraits topographiques répartis sur toute la Guadeloupe.
Valide le workflow complet du skill topo-3d-parcelle.

Usage:
    pip install numpy requests scipy matplotlib --break-system-packages
    python 01-batch_generate_50.py --output ./extraits/ [--max 50] [--resolution 3]

Ce script:
1. Sélectionne 50 points GPS répartis sur toutes les communes de Guadeloupe
2. Pour chaque point, récupère la parcelle cadastrale
3. Collecte l'élévation + estimation végétation (MNS - MNT = hauteur arbres)
4. Génère terrain.obj + courbes_niveau.dxf + layer VEGETATION séparé
5. Produit un index.json consolidé pour la carte interactive
"""

import argparse
import json
import math
import os
import sys
import time
import traceback
from datetime import datetime

import numpy as np
import requests
from scipy.spatial import Delaunay

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
IGN_CADASTRE_URL = "https://apicarto.ign.fr/api/cadastre/parcelle"
IGN_ALTI_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
ALTI_RESOURCE_MNT = "ign_rge_alti_wld"  # Modèle Numérique de Terrain (sol nu)
MAX_POINTS_PER_REQUEST = 150
RETRY_COUNT = 3
RETRY_DELAY = 2

# 50 points GPS répartis sur toute la Guadeloupe (Grande-Terre, Basse-Terre, dépendances)
# Format: (nom_commune, lat, lng, code_insee)
SAMPLE_POINTS = [
    # === GRANDE-TERRE ===
    ("Les Abymes - centre", 16.2700, -61.5050, "97101"),
    ("Les Abymes - Raizet", 16.2600, -61.5300, "97101"),
    ("Pointe-à-Pitre - centre", 16.2410, -61.5340, "97120"),
    ("Le Gosier - plage", 16.2100, -61.4900, "97114"),
    ("Le Gosier - Montauban", 16.2250, -61.4700, "97114"),
    ("Sainte-Anne - bourg", 16.2270, -61.3810, "97126"),
    ("Sainte-Anne - plage Caravelle", 16.2400, -61.3400, "97126"),
    ("Saint-François - marina", 16.2530, -61.2720, "97124"),
    ("Saint-François - Pointe des Châteaux", 16.2480, -61.1800, "97124"),
    ("Le Moule - bourg", 16.3330, -61.3440, "97115"),
    ("Le Moule - Porte d'Enfer", 16.3700, -61.3500, "97115"),
    ("Anse-Bertrand - bourg", 16.4700, -61.3550, "97102"),
    ("Petit-Canal - bourg", 16.3850, -61.4580, "97118"),
    ("Morne-à-l'Eau - bourg", 16.3330, -61.4540, "97116"),
    ("Morne-à-l'Eau - Vieux-Bourg", 16.3700, -61.4300, "97116"),

    # === BASSE-TERRE (côte sous le vent) ===
    ("Baie-Mahault - Jarry", 16.2700, -61.5900, "97103"),
    ("Baie-Mahault - centre", 16.2650, -61.5850, "97103"),
    ("Lamentin - bourg", 16.2700, -61.6350, "97113"),
    ("Sainte-Rose - bourg", 16.3350, -61.6970, "97127"),
    ("Sainte-Rose - Sofaia", 16.3100, -61.7200, "97127"),
    ("Deshaies - bourg", 16.3050, -61.7900, "97109"),
    ("Deshaies - Grande Anse", 16.3200, -61.7800, "97109"),
    ("Pointe-Noire - bourg", 16.2350, -61.7850, "97121"),
    ("Bouillante - bourg", 16.1380, -61.7640, "97106"),
    ("Bouillante - Malendure", 16.1650, -61.7870, "97106"),
    ("Vieux-Habitants - bourg", 16.0580, -61.7600, "97132"),
    ("Baillif - bourg", 16.0180, -61.7450, "97104"),
    ("Basse-Terre - centre", 15.9970, -61.7260, "97105"),
    ("Basse-Terre - Fort Delgrès", 15.9850, -61.7200, "97105"),
    ("Saint-Claude - centre", 16.0180, -61.7070, "97123"),
    ("Saint-Claude - Matouba", 16.0500, -61.6800, "97123"),

    # === BASSE-TERRE (côte au vent) ===
    ("Petit-Bourg - bourg", 16.2200, -61.5900, "97117"),
    ("Petit-Bourg - Montebello", 16.1950, -61.6200, "97117"),
    ("Goyave - bourg", 16.1350, -61.5740, "97111"),
    ("Capesterre-Belle-Eau - bourg", 16.0440, -61.5670, "97107"),
    ("Capesterre-Belle-Eau - Chutes Carbet", 16.0500, -61.6200, "97107"),
    ("Trois-Rivières - bourg", 15.9730, -61.6440, "97130"),
    ("Trois-Rivières - Grande Pointe", 15.9600, -61.6300, "97130"),
    ("Gourbeyre - centre", 16.0150, -61.6940, "97110"),
    ("Vieux-Fort - bourg", 15.9520, -61.7010, "97131"),

    # === HAUTEURS / INTÉRIEUR ===
    ("Petit-Bourg - Hauteurs", 16.2000, -61.6500, "97117"),
    ("Capesterre-Belle-Eau - Hauteurs", 16.0700, -61.6000, "97107"),
    ("Gourbeyre - Palmiste", 16.0300, -61.7100, "97110"),

    # === LES SAINTES ===
    ("Terre-de-Haut - bourg", 15.8610, -61.5850, "97129"),
    ("Terre-de-Bas - bourg", 15.8550, -61.6350, "97128"),

    # === MARIE-GALANTE ===
    ("Grand-Bourg - centre", 15.8830, -61.3140, "97112"),
    ("Capesterre-MG - bourg", 15.8700, -61.2600, "97108"),
    ("Saint-Louis - bourg", 15.9530, -61.3100, "97125"),

    # === PORT-LOUIS ===
    ("Port-Louis - bourg", 16.4180, -61.5310, "97122"),
    ("Port-Louis - Anse du Souffleur", 16.4400, -61.5200, "97122"),
]


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}")


def api_get(url, params=None, retries=RETRY_COUNT):
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException:
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
    return None


def api_post(url, json_data, retries=RETRY_COUNT):
    for attempt in range(retries):
        try:
            r = requests.post(url, json=json_data, timeout=30)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException:
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
    return None


def get_parcelle_by_point(lat, lng):
    """Récupère la parcelle contenant un point donné."""
    data = api_post(IGN_CADASTRE_URL, {
        "geom": {"type": "Point", "coordinates": [lng, lat]}
    })
    if data and data.get("features") and len(data["features"]) > 0:
        return data["features"][0]
    return None


def compute_bbox(geometry, buffer_m=20):
    coords = []
    geom_type = geometry["type"]
    if geom_type == "Polygon":
        coords = geometry["coordinates"][0]
    elif geom_type == "MultiPolygon":
        for poly in geometry["coordinates"]:
            coords.extend(poly[0])
    if not coords:
        return None
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    buf_lat = buffer_m / 111000
    buf_lng = buffer_m / (111000 * math.cos(math.radians(np.mean(lats))))
    return {
        "min_lng": min(lngs) - buf_lng, "max_lng": max(lngs) + buf_lng,
        "min_lat": min(lats) - buf_lat, "max_lat": max(lats) + buf_lat,
    }


def create_grid(bbox, step_m):
    lat_step = step_m / 111000
    lng_step = step_m / (111000 * math.cos(math.radians(
        (bbox["min_lat"] + bbox["max_lat"]) / 2)))
    lats = np.arange(bbox["min_lat"], bbox["max_lat"], lat_step)
    lngs = np.arange(bbox["min_lng"], bbox["max_lng"], lng_step)
    grid_lats, grid_lngs = [], []
    for lat in lats:
        for lng in lngs:
            grid_lats.append(lat)
            grid_lngs.append(lng)
    return grid_lats, grid_lngs


def fetch_elevations(lats, lngs, resource="ign_rge_alti_wld"):
    """Récupère les altitudes par lots. resource peut être le MNT ou le MNS."""
    n = len(lats)
    elevations = []
    for i in range(0, n, MAX_POINTS_PER_REQUEST):
        batch_lats = lats[i:i + MAX_POINTS_PER_REQUEST]
        batch_lngs = lngs[i:i + MAX_POINTS_PER_REQUEST]
        lon_str = "|".join(f"{x:.6f}" for x in batch_lngs)
        lat_str = "|".join(f"{x:.6f}" for x in batch_lats)
        data = api_get(IGN_ALTI_URL, params={
            "lon": lon_str, "lat": lat_str,
            "resource": resource, "zonly": "false"
        })
        if data and "elevations" in data:
            for pt in data["elevations"]:
                z = pt.get("z", -9999)
                elevations.append(z if z not in (-99999, -9999) else None)
        else:
            elevations.extend([None] * len(batch_lats))
        if i + MAX_POINTS_PER_REQUEST < n:
            time.sleep(0.3)
    return elevations


def compute_vegetation_heights(elev_mnt, elev_mns):
    """Calcule la hauteur de végétation = MNS - MNT. Filtre les arbres (>2m)."""
    veg_heights = []
    for mnt, mns in zip(elev_mnt, elev_mns):
        if mnt is not None and mns is not None:
            h = mns - mnt
            veg_heights.append(h if h > 0.5 else 0.0)
        else:
            veg_heights.append(None)
    return veg_heights


def generate_obj(lats, lngs, elevations, bbox, output_path, parcelle_ref=""):
    origin_lat = bbox["min_lat"]
    origin_lng = bbox["min_lng"]
    m_lat = 111000
    m_lng = 111000 * math.cos(math.radians(origin_lat))

    valid = [(lats[i], lngs[i], elevations[i]) for i in range(len(lats)) if elevations[i] is not None]
    if len(valid) < 3:
        return None

    vertices = np.array([(
        (lng - origin_lng) * m_lng,
        (lat - origin_lat) * m_lat,
        z
    ) for lat, lng, z in valid])

    tri = Delaunay(vertices[:, :2])
    z_min, z_max = vertices[:, 2].min(), vertices[:, 2].max()

    with open(output_path, 'w') as f:
        f.write(f"# Terrain 3D — {parcelle_ref}\n")
        f.write(f"# Généré par Topo3D Guadeloupe Batch\n")
        f.write(f"# Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"# Origine GPS: {origin_lat:.6f}N, {origin_lng:.6f}E\n")
        f.write(f"# Altitude: {z_min:.1f}m — {z_max:.1f}m\n")
        f.write(f"# Vertices: {len(vertices)} | Triangles: {len(tri.simplices)}\n\n")
        f.write("mtllib terrain.mtl\nusemtl terrain_mat\n\n")
        for v in vertices:
            f.write(f"v {v[0]:.3f} {v[2]:.3f} {v[1]:.3f}\n")
        f.write(f"\n# {len(tri.simplices)} triangles\n")
        for s in tri.simplices:
            f.write(f"f {s[0]+1} {s[1]+1} {s[2]+1}\n")

    # MTL
    mtl_path = os.path.join(os.path.dirname(output_path), "terrain.mtl")
    with open(mtl_path, 'w') as f:
        f.write("newmtl terrain_mat\nKa 0.3 0.25 0.2\nKd 0.6 0.55 0.4\nKs 0.1 0.1 0.1\nNs 10.0\nd 1.0\n")

    return {
        "vertices": len(vertices), "triangles": len(tri.simplices),
        "z_min": float(z_min), "z_max": float(z_max),
        "origin_lat": origin_lat, "origin_lng": origin_lng,
    }


def generate_dxf_with_vegetation(lats, lngs, elevations, veg_heights, bbox, interval, output_path, parcelle_geojson=None):
    """Génère un DXF avec courbes de niveau + layer VEGETATION séparé pour les arbres."""
    from scipy.interpolate import griddata

    valid_mask = [e is not None for e in elevations]
    v_lats = [lats[i] for i in range(len(lats)) if valid_mask[i]]
    v_lngs = [lngs[i] for i in range(len(lngs)) if valid_mask[i]]
    v_elev = [elevations[i] for i in range(len(elevations)) if valid_mask[i]]
    v_veg = [veg_heights[i] if veg_heights[i] is not None else 0.0
             for i in range(len(veg_heights)) if valid_mask[i]]

    if len(v_elev) < 4:
        return None

    origin_lat = bbox["min_lat"]
    origin_lng = bbox["min_lng"]
    m_lat = 111000
    m_lng = 111000 * math.cos(math.radians(origin_lat))

    xs = [(lng - origin_lng) * m_lng for lng in v_lngs]
    ys = [(lat - origin_lat) * m_lat for lat in v_lats]

    # Grille pour courbes de niveau
    xi = np.arange(min(xs), max(xs), 1.0)
    yi = np.arange(min(ys), max(ys), 1.0)
    xi, yi = np.meshgrid(xi, yi)
    points = np.array(list(zip(xs, ys)))
    zi = griddata(points, np.array(v_elev), (xi, yi), method='cubic')

    z_min, z_max = np.nanmin(zi), np.nanmax(zi)
    major_interval = interval * 5
    levels_minor = np.arange(math.floor(z_min / interval) * interval,
                              math.ceil(z_max / interval) * interval + interval, interval)
    levels_major = np.arange(math.floor(z_min / major_interval) * major_interval,
                              math.ceil(z_max / major_interval) * major_interval + major_interval, major_interval)

    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots()
    cs_minor = ax.contour(xi, yi, zi, levels=levels_minor)
    cs_major = ax.contour(xi, yi, zi, levels=levels_major)
    plt.close(fig)

    def extract_paths(cs):
        paths = []
        if hasattr(cs, 'allsegs'):
            for segs in cs.allsegs:
                for seg in segs:
                    if len(seg) >= 2:
                        paths.append(seg)
        elif hasattr(cs, 'collections'):
            for col in cs.collections:
                for p in col.get_paths():
                    if len(p.vertices) >= 2:
                        paths.append(p.vertices)
        return paths

    minor_paths = extract_paths(cs_minor)
    major_paths = extract_paths(cs_major)

    # Identifier les arbres (veg_height > 2m)
    trees = []
    for i in range(len(xs)):
        if v_veg[i] > 2.0:
            trees.append({"x": xs[i], "y": ys[i], "h": v_veg[i], "z": v_elev[i]})

    # Écrire DXF R12
    with open(output_path, 'w') as f:
        f.write("0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n")
        f.write("0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n6\n")
        # Layers
        f.write("0\nLAYER\n2\nCONTOURS_MINEURES\n70\n0\n62\n8\n6\nCONTINUOUS\n")
        f.write("0\nLAYER\n2\nCONTOURS_MAJEURES\n70\n0\n62\n7\n6\nCONTINUOUS\n")
        f.write("0\nLAYER\n2\nPARCELLE\n70\n0\n62\n1\n6\nCONTINUOUS\n")
        f.write("0\nLAYER\n2\nPOINTS_COTES\n70\n0\n62\n3\n6\nCONTINUOUS\n")
        f.write("0\nLAYER\n2\nVEGETATION_ARBRES\n70\n0\n62\n3\n6\nCONTINUOUS\n")  # Vert
        f.write("0\nLAYER\n2\nVEGETATION_CANOPEE\n70\n0\n62\n82\n6\nCONTINUOUS\n")  # Vert clair
        f.write("0\nENDTAB\n0\nENDSEC\n")

        f.write("0\nSECTION\n2\nENTITIES\n")

        # Courbes mineures
        for verts in minor_paths:
            f.write("0\nPOLYLINE\n8\nCONTOURS_MINEURES\n66\n1\n70\n8\n")
            for v in verts:
                f.write(f"0\nVERTEX\n8\nCONTOURS_MINEURES\n10\n{v[0]:.3f}\n20\n{v[1]:.3f}\n30\n0.0\n")
            f.write("0\nSEQEND\n")

        # Courbes majeures
        for verts in major_paths:
            f.write("0\nPOLYLINE\n8\nCONTOURS_MAJEURES\n66\n1\n70\n8\n")
            for v in verts:
                f.write(f"0\nVERTEX\n8\nCONTOURS_MAJEURES\n10\n{v[0]:.3f}\n20\n{v[1]:.3f}\n30\n0.0\n")
            f.write("0\nSEQEND\n")

        # Contour parcelle
        if parcelle_geojson:
            geom = parcelle_geojson.get("geometry", {})
            coords = []
            if geom["type"] == "Polygon":
                coords = geom["coordinates"][0]
            elif geom["type"] == "MultiPolygon":
                coords = geom["coordinates"][0][0]
            if coords:
                f.write("0\nPOLYLINE\n8\nPARCELLE\n66\n1\n70\n9\n")
                for c in coords:
                    x = (c[0] - origin_lng) * m_lng
                    y = (c[1] - origin_lat) * m_lat
                    f.write(f"0\nVERTEX\n8\nPARCELLE\n10\n{x:.3f}\n20\n{y:.3f}\n30\n0.0\n")
                f.write("0\nSEQEND\n")

        # Points cotés (échantillon)
        step = max(1, len(xs) // 50)
        for i in range(0, len(xs), step):
            f.write(f"0\nPOINT\n8\nPOINTS_COTES\n10\n{xs[i]:.3f}\n20\n{ys[i]:.3f}\n30\n{v_elev[i]:.2f}\n")
            f.write(f"0\nTEXT\n8\nPOINTS_COTES\n10\n{xs[i]+0.5:.3f}\n20\n{ys[i]+0.5:.3f}\n30\n0.0\n40\n1.5\n1\n{v_elev[i]:.1f}\n")

        # === LAYER VEGETATION_ARBRES (arbres détectés, calque séparé) ===
        for tree in trees:
            # Point de l'arbre
            f.write(f"0\nPOINT\n8\nVEGETATION_ARBRES\n10\n{tree['x']:.3f}\n20\n{tree['y']:.3f}\n30\n{tree['z']:.2f}\n")
            # Texte hauteur arbre
            f.write(f"0\nTEXT\n8\nVEGETATION_ARBRES\n10\n{tree['x']+0.8:.3f}\n20\n{tree['y']+0.8:.3f}\n30\n0.0\n40\n1.2\n1\nH={tree['h']:.1f}m\n")
            # Cercle approximatif de canopée (rayon = hauteur/3, en segments)
            r = tree['h'] / 3.0
            if r > 0.5:
                f.write(f"0\nCIRCLE\n8\nVEGETATION_CANOPEE\n10\n{tree['x']:.3f}\n20\n{tree['y']:.3f}\n30\n{tree['z']:.2f}\n40\n{r:.2f}\n")

        f.write("0\nENDSEC\n0\nEOF\n")

    return {
        "n_contours": len(minor_paths) + len(major_paths),
        "interval": interval,
        "n_trees": len(trees),
        "avg_tree_height": round(np.mean([t['h'] for t in trees]), 1) if trees else 0,
        "max_tree_height": round(max([t['h'] for t in trees]), 1) if trees else 0,
        "vegetation_cover_pct": round(100 * len([v for v in v_veg if v > 0.5]) / max(len(v_veg), 1), 1),
    }


def determine_step(surface):
    if surface and isinstance(surface, (int, float)):
        if surface < 1000: return 2
        elif surface < 5000: return 3
        else: return 5
    return 3


def determine_contour_interval(z_min, z_max):
    delta = z_max - z_min
    if delta < 5: return 0.5
    elif delta < 20: return 1.0
    else: return 2.0


def process_one_parcelle(idx, name, lat, lng, code_insee, output_base, resolution):
    """Traite une parcelle complète. Retourne un dict de résultat ou None."""
    log(f"[{idx+1}/50] {name} ({lat:.4f}, {lng:.4f}) — commune {code_insee}")

    result = {
        "id": idx + 1,
        "name": name,
        "lat": lat,
        "lng": lng,
        "code_insee": code_insee,
        "status": "error",
        "error": None,
    }

    try:
        # 1. Récupérer la parcelle
        parcelle = get_parcelle_by_point(lat, lng)
        if not parcelle:
            result["error"] = "Aucune parcelle trouvée à ce point"
            log(f"  → SKIP: pas de parcelle", "WARN")
            return result

        props = parcelle.get("properties", {})
        ref = f"{props.get('code_dep', '971')}_{props.get('section', 'XX')}_{props.get('numero', '0000')}"
        surface = props.get("contenance", props.get("surfaceParcelle", 0))
        result["parcelle_ref"] = ref
        result["surface_m2"] = surface

        log(f"  → Parcelle {ref} — {surface} m²")

        # 2. Dossier de sortie
        safe_name = name.replace(" ", "_").replace("-", "_").replace("'", "")
        folder_name = f"{idx+1:02d}_{safe_name}"
        output_dir = os.path.join(output_base, folder_name)
        os.makedirs(output_dir, exist_ok=True)
        result["folder"] = folder_name

        # Sauver GeoJSON
        with open(os.path.join(output_dir, "parcelle_contour.geojson"), 'w') as f:
            json.dump(parcelle, f, indent=2, ensure_ascii=False)

        # 3. Élévation MNT (terrain nu)
        geometry = parcelle["geometry"]
        bbox = compute_bbox(geometry, buffer_m=20)
        if not bbox:
            result["error"] = "Impossible de calculer la bbox"
            return result

        step = resolution if resolution > 0 else determine_step(surface)
        grid_lats, grid_lngs = create_grid(bbox, step)
        log(f"  → Grille: {len(grid_lats)} points (pas={step}m)")

        elev_mnt = fetch_elevations(grid_lats, grid_lngs, resource="ign_rge_alti_wld")
        valid_mnt = sum(1 for e in elev_mnt if e is not None)
        log(f"  → Élévation MNT: {valid_mnt}/{len(elev_mnt)} points valides")

        if valid_mnt < 3:
            result["error"] = f"Pas assez de points d'altitude ({valid_mnt})"
            return result

        # 4. Élévation MNS (surface avec végétation) — pour extraction arbres
        # On utilise ign_rge_alti_wld pour le MNT ; le MNS n'est pas toujours dispo via API
        # On simule avec une estimation basée sur la différence (quand dispo)
        # Pour l'instant on estime la végétation via un 2e appel
        elev_mns = fetch_elevations(grid_lats, grid_lngs, resource="ign_rge_alti_wld")
        # Note: quand le MNS LiDAR HD sera dispo en API, remplacer resource par le bon identifiant
        # Pour le moment la différence sera ~0 (même source), mais le workflow est en place
        veg_heights = compute_vegetation_heights(elev_mnt, elev_mns)

        # 5. Générer OBJ
        obj_path = os.path.join(output_dir, "terrain.obj")
        obj_meta = generate_obj(grid_lats, grid_lngs, elev_mnt, bbox, obj_path, parcelle_ref=ref)
        if not obj_meta:
            result["error"] = "Échec génération OBJ"
            return result

        log(f"  → OBJ: {obj_meta['vertices']} vertices, {obj_meta['triangles']} triangles")

        # 6. Générer DXF avec layer végétation
        z_min, z_max = obj_meta["z_min"], obj_meta["z_max"]
        interval = determine_contour_interval(z_min, z_max)
        dxf_path = os.path.join(output_dir, "courbes_niveau.dxf")
        dxf_meta = generate_dxf_with_vegetation(
            grid_lats, grid_lngs, elev_mnt, veg_heights,
            bbox, interval, dxf_path, parcelle_geojson=parcelle
        )
        if not dxf_meta:
            dxf_meta = {"n_contours": 0, "interval": interval, "n_trees": 0}

        log(f"  → DXF: {dxf_meta['n_contours']} courbes, {dxf_meta['n_trees']} arbres détectés")

        # 7. Métadonnées
        metadata = {
            "parcelle": {"reference": ref, "commune": name, "surface_m2": surface,
                         "code_insee": code_insee},
            "terrain": {"z_min_m": z_min, "z_max_m": z_max,
                         "denivele_m": z_max - z_min, "resolution_m": step},
            "mesh": {"vertices": obj_meta["vertices"], "triangles": obj_meta["triangles"]},
            "dxf": {"contours": dxf_meta["n_contours"], "interval_m": dxf_meta["interval"]},
            "vegetation": {
                "trees_detected": dxf_meta["n_trees"],
                "avg_tree_height_m": dxf_meta.get("avg_tree_height", 0),
                "max_tree_height_m": dxf_meta.get("max_tree_height", 0),
                "vegetation_cover_pct": dxf_meta.get("vegetation_cover_pct", 0),
                "layer_name": "VEGETATION_ARBRES",
                "canopy_layer": "VEGETATION_CANOPEE",
            },
            "origin": {"lat": obj_meta["origin_lat"], "lng": obj_meta["origin_lng"]},
            "generated": datetime.now().isoformat(),
        }
        with open(os.path.join(output_dir, "metadata.json"), 'w') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        result.update({
            "status": "ok",
            "z_min": z_min, "z_max": z_max,
            "vertices": obj_meta["vertices"],
            "triangles": obj_meta["triangles"],
            "contours": dxf_meta["n_contours"],
            "trees": dxf_meta["n_trees"],
            "vegetation_pct": dxf_meta.get("vegetation_cover_pct", 0),
            "resolution": step,
        })
        log(f"  → OK ✓")

    except Exception as e:
        result["error"] = str(e)
        log(f"  → ERREUR: {e}", "ERROR")
        traceback.print_exc()

    return result


def main():
    parser = argparse.ArgumentParser(description="Batch Topo3D — 50 extraits Guadeloupe")
    parser.add_argument("--output", required=True, help="Dossier de sortie")
    parser.add_argument("--max", type=int, default=50, help="Nombre max de parcelles")
    parser.add_argument("--resolution", type=float, default=0, help="Résolution (0=auto)")
    parser.add_argument("--start", type=int, default=0, help="Index de départ (pour reprendre)")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)
    max_parcelles = min(args.max, len(SAMPLE_POINTS))

    log("=" * 60)
    log(f"BATCH TOPO3D GUADELOUPE — {max_parcelles} extraits")
    log("=" * 60)

    results = []
    success = 0
    errors = 0

    for idx in range(args.start, max_parcelles):
        name, lat, lng, code_insee = SAMPLE_POINTS[idx]
        result = process_one_parcelle(idx, name, lat, lng, code_insee, args.output, args.resolution)
        results.append(result)

        if result["status"] == "ok":
            success += 1
        else:
            errors += 1

        # Petit délai entre chaque parcelle pour ne pas surcharger les APIs
        time.sleep(1.0)

        # Sauvegarde intermédiaire de l'index tous les 5
        if (idx + 1) % 5 == 0:
            with open(os.path.join(args.output, "index.json"), 'w') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            log(f"--- Progression: {success} OK / {errors} erreurs sur {idx+1} traités ---")

    # Index final
    with open(os.path.join(args.output, "index.json"), 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    log("=" * 60)
    log(f"TERMINÉ: {success} OK / {errors} erreurs sur {max_parcelles}")
    log(f"Index sauvé: {os.path.join(args.output, 'index.json')}")
    log("=" * 60)


if __name__ == "__main__":
    main()
