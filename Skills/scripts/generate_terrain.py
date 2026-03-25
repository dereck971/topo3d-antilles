#!/usr/bin/env python3
"""
Topo 3D Parcelle — Génère un mesh OBJ + courbes de niveau DXF
à partir d'une parcelle cadastrale en Guadeloupe (ou France).

Usage:
    python generate_terrain.py --input "971 AB 0123" --output ./sortie/
    python generate_terrain.py --input "12 rue de la Liberté, 97122 Baie-Mahault" --output ./sortie/
    python generate_terrain.py --input "16.0445,-61.6642,200" --output ./sortie/

Dépendances: numpy, requests, scipy
"""

import argparse
import json
import math
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import requests
from scipy.spatial import Delaunay

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
IGN_CADASTRE_URL = "https://apicarto.ign.fr/api/cadastre/parcelle"
IGN_ALTI_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
SRTM_ALTI_URL = "https://api.open-elevation.com/api/v1/lookup"  # CQ-3: Fallback SRTM
GEOCODE_URL = "https://api-adresse.data.gouv.fr/search/"
ALTI_RESOURCE = "ign_rge_alti_wld"
MAX_POINTS_PER_REQUEST = 150
RETRY_COUNT = 3
RETRY_DELAY = 2
ALTITUDE_SENTINEL = -99999  # CQ-4: Valeur sentinelle IGN pour données manquantes
ALTITUDE_MAX_ABS = 90000    # CQ-4: Seuil de filtrage des altitudes aberrantes

# ─────────────────────────────────────────────
# CQ-1/CQ-2: Chargement des sections pré-indexées
# ─────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SECTIONS_INDEX = {}  # {code_insee: [sections]}

def load_sections_index():
    """Charge les fichiers JSON de sections pré-indexées (GP + MQ)."""
    global SECTIONS_INDEX
    for filename in ["sections_guadeloupe.json", "sections_martinique.json"]:
        filepath = os.path.join(SCRIPT_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                for code, info in data.get("communes", {}).items():
                    SECTIONS_INDEX[code] = info.get("sections", [])
            log(f"Index sections chargé: {filepath} ({len(data.get('communes', {}))} communes)")

load_sections_index()

# CQ-5: Cache des géométries cadastrales
GEOMETRY_CACHE = {}
CACHE_MAX_SIZE = 200

def cache_get(key):
    """Récupère une géométrie du cache."""
    return GEOMETRY_CACHE.get(key)

def cache_set(key, value):
    """Stocke une géométrie dans le cache."""
    if len(GEOMETRY_CACHE) >= CACHE_MAX_SIZE:
        # Supprimer la plus ancienne entrée
        oldest = next(iter(GEOMETRY_CACHE))
        del GEOMETRY_CACHE[oldest]
    GEOMETRY_CACHE[key] = value

# Codes INSEE des communes de Guadeloupe
COMMUNES_971 = {
    "abymes": "97101", "anse-bertrand": "97102", "baie-mahault": "97103",
    "baillif": "97104", "basse-terre": "97105", "bouillante": "97106",
    "capesterre-belle-eau": "97107", "capesterre-de-marie-galante": "97108",
    "deshaies": "97109", "gourbeyre": "97110", "goyave": "97111",
    "grand-bourg": "97112", "lamentin": "97113", "le gosier": "97114",
    "le moule": "97115", "les abymes": "97101", "morne-a-l-eau": "97116",
    "petit-bourg": "97117", "petit-canal": "97118", "pointe-a-pitre": "97119",
    "pointe-noire": "97120", "port-louis": "97121", "saint-claude": "97122",
    "saint-francois": "97123", "saint-louis": "97124", "sainte-anne": "97125",
    "sainte-rose": "97126", "terre-de-bas": "97127", "terre-de-haut": "97128",
    "trois-rivieres": "97129", "vieux-fort": "97130", "vieux-habitants": "97131",
}

# Codes INSEE des communes de Martinique
COMMUNES_972 = {
    "ajoupa-bouillon": "97201", "anses-d-arlet": "97202", "basse-pointe": "97203",
    "le carbet": "97204", "case-pilote": "97205", "le diamant": "97206",
    "ducos": "97207", "fonds-saint-denis": "97208", "fort-de-france": "97209",
    "le francois": "97210", "grand-riviere": "97211", "gros-morne": "97213",
    "le lamentin": "97214", "le lorrain": "97215", "macouba": "97216",
    "le marigot": "97217", "le marin": "97218", "le morne-rouge": "97219",
    "riviere-pilote": "97220", "le precheur": "97221", "le robert": "97222",
    "le vauclin": "97223", "saint-joseph": "97224", "saint-pierre": "97225",
    "sainte-anne-mq": "97226", "sainte-luce": "97227", "sainte-marie": "97228",
    "schoelcher": "97229", "trinite": "97230", "trois-ilets": "97231",
    "saint-esprit": "97232", "riviere-salee": "97233", "bellefontaine": "97234",
    "le morne-vert": "97235",
}


def log(msg, level="INFO"):
    print(f"[{level}] {msg}")


# ─────────────────────────────────────────────
# Détection du type d'entrée
# ─────────────────────────────────────────────
def detect_input_type(input_str):
    """Détecte si l'entrée est une ref cadastrale, des coordonnées GPS, ou une adresse."""
    s = input_str.strip()

    # Coordonnées GPS: "16.0445,-61.6642,200" ou "16.0445 -61.6642 200"
    coord_match = re.match(
        r'^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+(\d+\.?\d*)$', s
    )
    if coord_match:
        lat, lng, radius = float(coord_match.group(1)), float(coord_match.group(2)), float(coord_match.group(3))
        # Guadeloupe: lat ~16, lng ~-61
        if abs(lat) > 90:
            lat, lng = lng, lat
        return "coords", {"lat": lat, "lng": lng, "radius": radius}

    # Référence cadastrale: "971 AB 0123" ou "971-AB-123" ou "Baie-Mahault AB 45"
    # On essaie d'abord un pattern strict avec code numérique
    cad_num_match = re.match(r'^(\d{3,5})\s*[\s\-]?\s*([A-Z]{1,2})\s*[\s\-]?\s*(\d{1,5})$', s, re.IGNORECASE)
    if cad_num_match:
        code = cad_num_match.group(1).strip()
        section = cad_num_match.group(2).upper()
        numero = cad_num_match.group(3).zfill(4)
        if len(code) == 3:
            return "cadastre", {"code_dep": code, "section": section, "numero": numero}
        else:
            return "cadastre", {"code_dep": code[:3], "code_com": code, "section": section, "numero": numero}

    # Pattern avec nom de commune : "Baie-Mahault AB 45", "Petit-Bourg AB 12"
    cad_name_match = re.match(r'^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]+?)\s+([A-Z]{1,2})\s+(\d{1,5})$', s, re.IGNORECASE)
    if cad_name_match:
        commune_str = cad_name_match.group(1).strip()
        section = cad_name_match.group(2).upper()
        numero = cad_name_match.group(3).zfill(4)
        commune_key = commune_str.lower().strip()
        # Recherche exacte puis fuzzy dans les communes 971 + 972
        code_com = COMMUNES_971.get(commune_key)
        code_dep = "971"
        if not code_com:
            code_com = COMMUNES_972.get(commune_key)
            if code_com:
                code_dep = "972"
        if not code_com:
            for k, v in COMMUNES_971.items():
                if commune_key in k or k in commune_key:
                    code_com = v
                    code_dep = "971"
                    break
        if not code_com:
            for k, v in COMMUNES_972.items():
                if commune_key in k or k in commune_key:
                    code_com = v
                    code_dep = "972"
                    break
        if code_com:
            return "cadastre", {
                "code_dep": code_dep, "code_com": code_com,
                "section": section, "numero": numero
            }

    # Sinon: adresse postale
    return "address", {"address": s}


# ─────────────────────────────────────────────
# API calls avec retry
# ─────────────────────────────────────────────
def api_get(url, params=None, retries=RETRY_COUNT):
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                wait = RETRY_DELAY * (attempt + 1)
                log(f"Rate limited, attente {wait}s...", "WARN")
                time.sleep(wait)
            else:
                log(f"HTTP {r.status_code}: {r.text[:200]}", "WARN")
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException as e:
            log(f"Erreur réseau: {e}", "WARN")
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
                log(f"HTTP {r.status_code}: {r.text[:200]}", "WARN")
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException as e:
            log(f"Erreur réseau: {e}", "WARN")
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
    return None


# ─────────────────────────────────────────────
# Étape 1 : Récupérer le contour de la parcelle
# ─────────────────────────────────────────────
def geocode_address(address):
    """Géocode une adresse via l'API Adresse du gouvernement."""
    log(f"Géocodage de: {address}")
    data = api_get(GEOCODE_URL, params={"q": address, "limit": 1})
    if data and data.get("features"):
        feat = data["features"][0]
        coords = feat["geometry"]["coordinates"]
        props = feat["properties"]
        log(f"  → {props.get('label', '?')} ({coords[1]:.5f}, {coords[0]:.5f})")
        return coords[1], coords[0], props  # lat, lng, properties
    log("Géocodage échoué", "ERROR")
    return None, None, None


def get_parcelle_by_ref(code_dep, section, numero, code_com=None):
    """Récupère la parcelle par référence cadastrale.
    L'API IGN utilise code_insee (5 chiffres) et non code_dep pour les DOM-TOM.
    CQ-1/CQ-2: Utilise l'index des sections pré-indexées pour une recherche ciblée.
    CQ-5: Utilise le cache des géométries.
    """
    log(f"Recherche parcelle: dep={code_dep} section={section} numero={numero} com={code_com}")

    # CQ-5: Vérifier le cache
    cache_key = f"{code_com or code_dep}_{section}_{numero}"
    cached = cache_get(cache_key)
    if cached:
        log(f"  → Trouvée dans le cache")
        return cached

    # Stratégie 1: Si on a le code_com (code INSEE), l'utiliser directement
    if code_com:
        params = {"code_insee": code_com, "section": section, "numero": numero}
        data = api_get(IGN_CADASTRE_URL, params=params)
        if data and data.get("features"):
            log(f"  → {len(data['features'])} parcelle(s) trouvée(s) (via code_insee={code_com})")
            cache_set(cache_key, data["features"][0])
            return data["features"][0]

        # CQ-1: Si la section exacte ne marche pas, utiliser l'index pré-indexé
        if code_com in SECTIONS_INDEX:
            known_sections = SECTIONS_INDEX[code_com]
            if section not in known_sections and known_sections:
                log(f"  Section {section} inconnue pour {code_com}, essai des sections indexées: {known_sections[:5]}...")
                for alt_section in known_sections:
                    params = {"code_insee": code_com, "section": alt_section, "numero": numero}
                    data = api_get(IGN_CADASTRE_URL, params=params)
                    if data and data.get("features"):
                        log(f"  → Trouvée avec section alternative {alt_section}")
                        cache_set(cache_key, data["features"][0])
                        return data["features"][0]
                    time.sleep(0.1)

    # Stratégie 2: Recherche par département DOM-TOM avec index pré-indexé
    communes_dict = None
    if code_dep == "971":
        communes_dict = COMMUNES_971
    elif code_dep == "972":
        communes_dict = COMMUNES_972

    if communes_dict:
        for commune_name, code_insee in communes_dict.items():
            # CQ-1: Vérifier si la section existe dans cette commune via l'index
            if code_insee in SECTIONS_INDEX:
                if section not in SECTIONS_INDEX[code_insee]:
                    continue  # Skip: cette section n'existe pas dans cette commune

            params = {"code_insee": code_insee, "section": section, "numero": numero}
            data = api_get(IGN_CADASTRE_URL, params=params)
            if data and data.get("features"):
                log(f"  → Trouvée dans {commune_name} (code_insee={code_insee})")
                cache_set(cache_key, data["features"][0])
                return data["features"][0]
            time.sleep(0.15)

    # Stratégie 3: Fallback code_dep classique (métropole)
    params = {"code_dep": code_dep, "section": section, "numero": numero}
    if code_com:
        params["code_com"] = code_com
    data = api_get(IGN_CADASTRE_URL, params=params)
    if data and data.get("features"):
        log(f"  → {len(data['features'])} parcelle(s) trouvée(s)")
        cache_set(cache_key, data["features"][0])
        return data["features"][0]

    log("Parcelle non trouvée", "ERROR")
    return None


def get_parcelle_by_point(lat, lng):
    """Récupère la parcelle contenant un point donné."""
    log(f"Recherche parcelle au point: {lat:.5f}, {lng:.5f}")
    data = api_post(IGN_CADASTRE_URL, {
        "geom": {"type": "Point", "coordinates": [lng, lat]}
    })
    if data and data.get("features"):
        log(f"  → {len(data['features'])} parcelle(s) trouvée(s)")
        return data["features"][0]
    log("Aucune parcelle trouvée à ce point", "ERROR")
    return None


def get_parcelle(input_type, input_data):
    """Orchestre la récupération de la parcelle selon le type d'entrée."""
    if input_type == "cadastre":
        return get_parcelle_by_ref(
            input_data["code_dep"],
            input_data["section"],
            input_data["numero"],
            input_data.get("code_com")
        )
    elif input_type == "address":
        lat, lng, props = geocode_address(input_data["address"])
        if lat is None:
            return None
        return get_parcelle_by_point(lat, lng)
    elif input_type == "coords":
        return get_parcelle_by_point(input_data["lat"], input_data["lng"])
    return None


# ─────────────────────────────────────────────
# Étape 2 : Collecter l'élévation
# ─────────────────────────────────────────────
def compute_bbox(geometry, buffer_m=20):
    """Calcule la bounding box d'une géométrie GeoJSON avec buffer."""
    coords = []
    geom_type = geometry["type"]
    if geom_type == "Polygon":
        coords = geometry["coordinates"][0]
    elif geom_type == "MultiPolygon":
        for poly in geometry["coordinates"]:
            coords.extend(poly[0])
    else:
        coords = geometry.get("coordinates", [])

    if not coords:
        return None

    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    # Buffer en degrés (~1 deg lat ≈ 111km à l'équateur, ~1 deg lng ≈ 100km à 16°N)
    buf_lat = buffer_m / 111000
    buf_lng = buffer_m / (111000 * math.cos(math.radians(np.mean(lats))))

    return {
        "min_lng": min(lngs) - buf_lng,
        "max_lng": max(lngs) + buf_lng,
        "min_lat": min(lats) - buf_lat,
        "max_lat": max(lats) + buf_lat,
    }


def create_grid(bbox, step_m):
    """Crée une grille régulière de points dans la bbox."""
    lat_step = step_m / 111000
    lng_step = step_m / (111000 * math.cos(math.radians(
        (bbox["min_lat"] + bbox["max_lat"]) / 2
    )))

    lats = np.arange(bbox["min_lat"], bbox["max_lat"], lat_step)
    lngs = np.arange(bbox["min_lng"], bbox["max_lng"], lng_step)

    grid_lats = []
    grid_lngs = []
    for lat in lats:
        for lng in lngs:
            grid_lats.append(lat)
            grid_lngs.append(lng)

    log(f"Grille: {len(lats)}×{len(lngs)} = {len(grid_lats)} points (pas={step_m}m)")
    return grid_lats, grid_lngs


def fetch_elevations_srtm(lats, lngs):
    """CQ-3: Fallback SRTM (30m) via Open Elevation API pour les points manquants."""
    log(f"Fallback SRTM pour {len(lats)} points...")
    elevations = [None] * len(lats)
    batch_size = 50  # API Open Elevation accepte ~100 points max

    for i in range(0, len(lats), batch_size):
        batch = []
        for j in range(i, min(i + batch_size, len(lats))):
            batch.append({"latitude": lats[j], "longitude": lngs[j]})

        try:
            r = requests.post(SRTM_ALTI_URL, json={"locations": batch}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                for k, result in enumerate(data.get("results", [])):
                    z = result.get("elevation")
                    if z is not None and abs(z) < ALTITUDE_MAX_ABS:
                        elevations[i + k] = z
        except Exception as e:
            log(f"  SRTM batch {i//batch_size + 1}: erreur {e}", "WARN")
        time.sleep(0.2)

    valid = sum(1 for z in elevations if z is not None)
    log(f"  SRTM: {valid}/{len(lats)} points récupérés")
    return elevations


def fetch_elevations(lats, lngs):
    """Récupère les altitudes par lots via l'API IGN.
    CQ-3: Fallback SRTM pour les points manquants.
    CQ-4: Filtrage des altitudes aberrantes (-99999, valeurs > 90000).
    """
    n = len(lats)
    elevations = []
    batch_size = MAX_POINTS_PER_REQUEST

    log(f"Récupération de {n} points d'altitude...")

    for i in range(0, n, batch_size):
        batch_lats = lats[i:i + batch_size]
        batch_lngs = lngs[i:i + batch_size]

        lon_str = "|".join(f"{x:.6f}" for x in batch_lngs)
        lat_str = "|".join(f"{x:.6f}" for x in batch_lats)

        data = api_get(IGN_ALTI_URL, params={
            "lon": lon_str,
            "lat": lat_str,
            "resource": ALTI_RESOURCE,
            "zonly": "false"
        })

        if data and "elevations" in data:
            for pt in data["elevations"]:
                z = pt.get("z", -9999)
                # CQ-4: Filtrer les valeurs sentinelles et aberrantes
                if z == ALTITUDE_SENTINEL or z == -9999 or abs(z) >= ALTITUDE_MAX_ABS:
                    z = None
                elevations.append(z)
        else:
            elevations.extend([None] * len(batch_lats))
            log(f"  Lot {i//batch_size + 1}: échec", "WARN")

        progress = min(i + batch_size, n)
        log(f"  {progress}/{n} points ({100*progress//n}%)")

        if i + batch_size < n:
            time.sleep(0.3)

    valid = sum(1 for z in elevations if z is not None)
    missing = n - valid
    log(f"Élévation IGN: {valid}/{n} points valides ({missing} manquants)")

    # CQ-3: Fallback SRTM pour les points manquants
    if missing > 0:
        missing_indices = [i for i, z in enumerate(elevations) if z is None]
        missing_lats = [lats[i] for i in missing_indices]
        missing_lngs = [lngs[i] for i in missing_indices]

        srtm_elevs = fetch_elevations_srtm(missing_lats, missing_lngs)
        recovered = 0
        for idx, srtm_z in zip(missing_indices, srtm_elevs):
            if srtm_z is not None:
                elevations[idx] = srtm_z
                recovered += 1

        if recovered > 0:
            log(f"  SRTM a récupéré {recovered}/{missing} points manquants")

    final_valid = sum(1 for z in elevations if z is not None)
    log(f"Élévation finale: {final_valid}/{n} points valides")
    return elevations


# ─────────────────────────────────────────────
# Étape 3 : Générer le mesh OBJ
# ─────────────────────────────────────────────
def generate_obj(lats, lngs, elevations, bbox, output_path, parcelle_ref=""):
    """Génère un fichier .OBJ à partir de la grille d'élévation."""
    # Filtrer les points sans altitude
    valid_points = []
    for i in range(len(lats)):
        if elevations[i] is not None:
            valid_points.append((lats[i], lngs[i], elevations[i]))

    if len(valid_points) < 3:
        log("Pas assez de points valides pour créer un mesh", "ERROR")
        return None

    # Convertir en coordonnées locales (mètres)
    origin_lat = bbox["min_lat"]
    origin_lng = bbox["min_lng"]
    m_per_deg_lat = 111000
    m_per_deg_lng = 111000 * math.cos(math.radians(origin_lat))

    vertices = []
    for lat, lng, z in valid_points:
        x = (lng - origin_lng) * m_per_deg_lng
        y = (lat - origin_lat) * m_per_deg_lat
        vertices.append((x, y, z))

    vertices = np.array(vertices)

    # Triangulation de Delaunay sur X,Y
    points_2d = vertices[:, :2]
    tri = Delaunay(points_2d)

    # Écrire le fichier OBJ
    z_min = vertices[:, 2].min()
    z_max = vertices[:, 2].max()
    n_verts = len(vertices)
    n_faces = len(tri.simplices)

    with open(output_path, 'w') as f:
        f.write(f"# Terrain 3D — Parcelle {parcelle_ref}\n")
        f.write(f"# Généré par Topo3D Parcelle — KCI\n")
        f.write(f"# Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"# Origine GPS: {origin_lat:.6f}N, {origin_lng:.6f}E\n")
        f.write(f"# Altitude: {z_min:.1f}m — {z_max:.1f}m\n")
        f.write(f"# Vertices: {n_verts} | Triangles: {n_faces}\n")
        f.write(f"# Coordonnées locales: X=Est(m), Y=Nord(m), Z=Altitude(m)\n\n")
        f.write(f"mtllib terrain.mtl\n")
        f.write(f"usemtl terrain_mat\n\n")

        # Vertices
        for v in vertices:
            f.write(f"v {v[0]:.3f} {v[2]:.3f} {v[1]:.3f}\n")
            # Note: OBJ convention Y=up, so z→Y and y→Z

        f.write(f"\n# Normales (approximées par face)\n")

        # Faces (1-indexed)
        f.write(f"\n# {n_faces} triangles\n")
        for simplex in tri.simplices:
            f.write(f"f {simplex[0]+1} {simplex[1]+1} {simplex[2]+1}\n")

    # Fichier MTL
    mtl_path = os.path.join(os.path.dirname(output_path), "terrain.mtl")
    with open(mtl_path, 'w') as f:
        f.write("# Matériau terrain\n")
        f.write("newmtl terrain_mat\n")
        f.write("Ka 0.3 0.25 0.2\n")
        f.write("Kd 0.6 0.55 0.4\n")
        f.write("Ks 0.1 0.1 0.1\n")
        f.write("Ns 10.0\n")
        f.write("d 1.0\n")

    log(f"OBJ généré: {n_verts} vertices, {n_faces} triangles")
    return {
        "vertices": n_verts,
        "triangles": n_faces,
        "z_min": float(z_min),
        "z_max": float(z_max),
        "origin_lat": origin_lat,
        "origin_lng": origin_lng,
    }


# ─────────────────────────────────────────────
# Étape 4 : Générer les courbes de niveau DXF
# ─────────────────────────────────────────────
def generate_contours(lats, lngs, elevations, bbox, interval, output_path, parcelle_geojson=None):
    """Génère un fichier DXF R12 avec les courbes de niveau."""
    from scipy.interpolate import griddata

    # Préparer les données
    valid_mask = [e is not None for e in elevations]
    v_lats = [lats[i] for i in range(len(lats)) if valid_mask[i]]
    v_lngs = [lngs[i] for i in range(len(lngs)) if valid_mask[i]]
    v_elev = [elevations[i] for i in range(len(elevations)) if valid_mask[i]]

    if len(v_elev) < 4:
        log("Pas assez de points pour les courbes de niveau", "ERROR")
        return None

    # Conversion en coordonnées locales
    origin_lat = bbox["min_lat"]
    origin_lng = bbox["min_lng"]
    m_per_deg_lat = 111000
    m_per_deg_lng = 111000 * math.cos(math.radians(origin_lat))

    xs = [(lng - origin_lng) * m_per_deg_lng for lng in v_lngs]
    ys = [(lat - origin_lat) * m_per_deg_lat for lat in v_lats]

    # Grille régulière pour interpolation
    grid_res = 1.0  # 1m pour les courbes de niveau
    xi = np.arange(min(xs), max(xs), grid_res)
    yi = np.arange(min(ys), max(ys), grid_res)
    xi, yi = np.meshgrid(xi, yi)

    zi = griddata(
        np.array(list(zip(xs, ys))),
        np.array(v_elev),
        (xi, yi),
        method='cubic'
    )

    # Calculer les niveaux de contour
    z_min = np.nanmin(zi)
    z_max = np.nanmax(zi)
    major_interval = interval * 5

    levels_minor = np.arange(
        math.floor(z_min / interval) * interval,
        math.ceil(z_max / interval) * interval + interval,
        interval
    )
    levels_major = np.arange(
        math.floor(z_min / major_interval) * major_interval,
        math.ceil(z_max / major_interval) * major_interval + major_interval,
        major_interval
    )

    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    def extract_contour_paths(contour_set):
        """Extrait les chemins d'un QuadContourSet, compatible toutes versions matplotlib."""
        paths = []
        # Nouvelle API (matplotlib >= 3.8) : allsegs
        if hasattr(contour_set, 'allsegs'):
            for level_segs in contour_set.allsegs:
                for seg in level_segs:
                    if len(seg) >= 2:
                        paths.append(seg)
        # Ancienne API : collections
        elif hasattr(contour_set, 'collections'):
            for collection in contour_set.collections:
                for path in collection.get_paths():
                    if len(path.vertices) >= 2:
                        paths.append(path.vertices)
        return paths

    # Extraire les contours avec matplotlib
    fig, ax = plt.subplots()
    cs_minor = ax.contour(xi, yi, zi, levels=levels_minor)
    cs_major = ax.contour(xi, yi, zi, levels=levels_major)
    plt.close(fig)

    minor_paths = extract_contour_paths(cs_minor)
    major_paths = extract_contour_paths(cs_major)

    # Écrire le DXF R12
    with open(output_path, 'w') as f:
        # Header DXF R12
        f.write("0\nSECTION\n2\nHEADER\n")
        f.write("9\n$ACADVER\n1\nAC1009\n")
        f.write("0\nENDSEC\n")

        # Tables (layers)
        f.write("0\nSECTION\n2\nTABLES\n")
        f.write("0\nTABLE\n2\nLAYER\n70\n4\n")

        # Layer CONTOURS_MINEURES
        f.write("0\nLAYER\n2\nCONTOURS_MINEURES\n70\n0\n62\n8\n6\nCONTINUOUS\n")
        # Layer CONTOURS_MAJEURES
        f.write("0\nLAYER\n2\nCONTOURS_MAJEURES\n70\n0\n62\n7\n6\nCONTINUOUS\n")
        # Layer PARCELLE
        f.write("0\nLAYER\n2\nPARCELLE\n70\n0\n62\n1\n6\nCONTINUOUS\n")
        # Layer POINTS_COTES
        f.write("0\nLAYER\n2\nPOINTS_COTES\n70\n0\n62\n3\n6\nCONTINUOUS\n")

        f.write("0\nENDTAB\n")
        f.write("0\nENDSEC\n")

        # Entities section
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

        # Contour de parcelle si disponible
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
                    x = (c[0] - origin_lng) * m_per_deg_lng
                    y = (c[1] - origin_lat) * m_per_deg_lat
                    f.write(f"0\nVERTEX\n8\nPARCELLE\n10\n{x:.3f}\n20\n{y:.3f}\n30\n0.0\n")
                f.write("0\nSEQEND\n")

        # Points cotés (échantillon)
        step = max(1, len(xs) // 50)
        for i in range(0, len(xs), step):
            f.write(f"0\nPOINT\n8\nPOINTS_COTES\n10\n{xs[i]:.3f}\n20\n{ys[i]:.3f}\n30\n{v_elev[i]:.2f}\n")
            f.write(f"0\nTEXT\n8\nPOINTS_COTES\n10\n{xs[i]+0.5:.3f}\n20\n{ys[i]+0.5:.3f}\n30\n0.0\n40\n1.5\n1\n{v_elev[i]:.1f}\n")

        f.write("0\nENDSEC\n")
        f.write("0\nEOF\n")

    n_contours = len(minor_paths) + len(major_paths)
    log(f"DXF généré: {n_contours} courbes de niveau (intervalle={interval}m)")
    return {"n_contours": n_contours, "interval": interval}


# ─────────────────────────────────────────────
# Étape 5 : Rapport + métadonnées
# ─────────────────────────────────────────────
def generate_report(parcelle_feature, obj_meta, dxf_meta, step, output_dir):
    """Génère le rapport récapitulatif et les métadonnées."""
    props = parcelle_feature.get("properties", {})
    ref = f"{props.get('code_dep', '?')} {props.get('section', '?')} {props.get('numero', '?')}"
    commune = props.get("nom_com", props.get("commune", "?"))
    surface = props.get("contenance", props.get("surfaceParcelle", "?"))

    z_min = obj_meta.get("z_min", 0)
    z_max = obj_meta.get("z_max", 0)
    delta_z = z_max - z_min
    pente = (delta_z / (step * obj_meta.get("vertices", 1) ** 0.5)) * 100 if delta_z > 0 else 0

    report = f"""# Rapport Topographique 3D

## Parcelle {ref}

| Paramètre | Valeur |
|---|---|
| Commune | {commune}, Guadeloupe |
| Surface cadastrale | {surface} m² |
| Altitude min | {z_min:.1f} m |
| Altitude max | {z_max:.1f} m |
| Dénivelé | {delta_z:.1f} m |
| Résolution grille | {step} m |
| Points d'altitude | {obj_meta.get('vertices', '?')} |
| Triangles mesh | {obj_meta.get('triangles', '?')} |
| Courbes de niveau | {dxf_meta.get('n_contours', '?')} (intervalle {dxf_meta.get('interval', '?')}m) |
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
- **Origine** : {obj_meta.get('origin_lat', 0):.6f}°N, {obj_meta.get('origin_lng', 0):.6f}°E
- **Axes** : X = Est (mètres), Y = Altitude (mètres), Z = Nord (mètres)
- Pour recaler dans un SIG, utiliser l'origine GPS ci-dessus

## Sources de données

- **Élévation** : [IGN RGE ALTI®](https://geoservices.ign.fr/rgealti) via API Géoplateforme
- **Cadastre** : [API Carto IGN](https://apicarto.ign.fr/api/doc/cadastre) — Parcellaire Express PCI
- **Géocodage** : [API Adresse data.gouv.fr](https://api-adresse.data.gouv.fr/)
- **Précision** : RGE ALTI ±0.2m (LiDAR) à ±1m (photogrammétrie) selon la zone

---
*Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} par Topo3D Parcelle — KCI*
"""

    with open(os.path.join(output_dir, "rapport.md"), 'w') as f:
        f.write(report)

    # Métadonnées JSON
    metadata = {
        "parcelle": {
            "reference": ref,
            "commune": commune,
            "surface_m2": surface,
            "code_dep": props.get("code_dep"),
            "code_com": props.get("code_com"),
        },
        "terrain": {
            "z_min_m": z_min,
            "z_max_m": z_max,
            "denivele_m": delta_z,
            "resolution_m": step,
        },
        "mesh": {
            "vertices": obj_meta.get("vertices"),
            "triangles": obj_meta.get("triangles"),
            "format": "OBJ (Wavefront)",
        },
        "dxf": {
            "contours": dxf_meta.get("n_contours"),
            "interval_m": dxf_meta.get("interval"),
            "format": "DXF R12 (AC1009)",
        },
        "origin": {
            "lat": obj_meta.get("origin_lat"),
            "lng": obj_meta.get("origin_lng"),
            "crs": "WGS84 (EPSG:4326)",
        },
        "source": "IGN RGE ALTI via API Géoplateforme",
        "generated": datetime.now().isoformat(),
    }

    with open(os.path.join(output_dir, "metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    log("Rapport et métadonnées générés")
    return report


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
def determine_step(surface):
    """Détermine le pas de grille optimal selon la surface."""
    if surface and isinstance(surface, (int, float)):
        if surface < 1000:
            return 2
        elif surface < 5000:
            return 3
        else:
            return 5
    return 3  # défaut


def determine_contour_interval(z_min, z_max):
    """Détermine l'intervalle de courbes de niveau selon le dénivelé."""
    delta = z_max - z_min
    if delta < 5:
        return 0.5
    elif delta < 20:
        return 1.0
    else:
        return 2.0


def main():
    parser = argparse.ArgumentParser(description="Topo 3D Parcelle — Générateur de terrain 3D")
    parser.add_argument("--input", required=True, help="Référence cadastrale, adresse, ou coordonnées GPS")
    parser.add_argument("--output", required=True, help="Dossier de sortie")
    parser.add_argument("--resolution", type=float, default=0, help="Pas de grille en mètres (0=auto)")
    parser.add_argument("--contour-interval", type=float, default=0, help="Intervalle courbes de niveau (0=auto)")
    parser.add_argument("--buffer", type=float, default=20, help="Buffer autour de la parcelle (mètres)")
    args = parser.parse_args()

    log("=" * 50)
    log("TOPO 3D PARCELLE — Génération de terrain")
    log("=" * 50)

    # 1. Détecter le type d'entrée
    input_type, input_data = detect_input_type(args.input)
    log(f"Type d'entrée détecté: {input_type}")

    # 2. Récupérer la parcelle
    parcelle = get_parcelle(input_type, input_data)
    if parcelle is None:
        log("Impossible de trouver la parcelle. Vérifiez votre entrée.", "ERROR")
        sys.exit(1)

    geometry = parcelle["geometry"]
    props = parcelle.get("properties", {})
    surface = props.get("contenance", props.get("surfaceParcelle"))
    ref = f"{props.get('code_dep', '?')}_{props.get('section', '?')}_{props.get('numero', '?')}"

    log(f"Parcelle trouvée: {ref} — {surface} m²")

    # 3. Créer le dossier de sortie
    output_dir = os.path.join(args.output, f"{ref}_topo3d")
    os.makedirs(output_dir, exist_ok=True)

    # Sauvegarder le contour GeoJSON
    with open(os.path.join(output_dir, "parcelle_contour.geojson"), 'w') as f:
        json.dump(parcelle, f, indent=2, ensure_ascii=False)

    # 4. Collecter l'élévation
    bbox = compute_bbox(geometry, buffer_m=args.buffer)
    step = args.resolution if args.resolution > 0 else determine_step(surface)

    grid_lats, grid_lngs = create_grid(bbox, step)
    elevations = fetch_elevations(grid_lats, grid_lngs)

    # 5. Générer le mesh OBJ
    obj_path = os.path.join(output_dir, "terrain.obj")
    obj_meta = generate_obj(grid_lats, grid_lngs, elevations, bbox, obj_path, parcelle_ref=ref)

    if obj_meta is None:
        log("Échec de la génération du mesh OBJ", "ERROR")
        sys.exit(1)

    # 6. Générer les courbes de niveau DXF
    z_min = obj_meta["z_min"]
    z_max = obj_meta["z_max"]
    interval = args.contour_interval if args.contour_interval > 0 else determine_contour_interval(z_min, z_max)

    dxf_path = os.path.join(output_dir, "courbes_niveau.dxf")
    dxf_meta = generate_contours(
        grid_lats, grid_lngs, elevations, bbox, interval, dxf_path,
        parcelle_geojson=parcelle
    )

    if dxf_meta is None:
        dxf_meta = {"n_contours": 0, "interval": interval}

    # 7. Rapport
    generate_report(parcelle, obj_meta, dxf_meta, step, output_dir)

    log("=" * 50)
    log(f"TERMINÉ — Fichiers dans: {output_dir}")
    log("=" * 50)
    log(f"  terrain.obj         ({obj_meta['vertices']} vertices, {obj_meta['triangles']} triangles)")
    log(f"  courbes_niveau.dxf  ({dxf_meta['n_contours']} courbes)")
    log(f"  parcelle_contour.geojson")
    log(f"  rapport.md")
    log(f"  metadata.json")


if __name__ == "__main__":
    main()
