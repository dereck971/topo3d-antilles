#!/usr/bin/env python3
"""
Module Diagnostic Réglementaire — Enrichissement du skill Topo 3D Parcelle

Ajoute 3 modules de détection automatique :
1. Géorisques (PPRN/PPRI — zones rouge/bleue/orange)
2. GPU Prescriptions + SUP (servitudes, ABF, emplacements réservés)
3. Loi Littoral (bande 100m, espaces remarquables, communes littorales)

Dépendances: requests (déjà présent dans generate_terrain.py)
"""

import json
import math
import time
import requests
from urllib.parse import quote

# ─────────────────────────────────────────────
# Configuration API
# ─────────────────────────────────────────────
GEORISQUES_BASE = "https://www.georisques.gouv.fr/api/v1"
GPU_BASE = "https://apicarto.ign.fr/api/gpu"
RETRY_COUNT = 3
RETRY_DELAY = 2

# Communes littorales de Guadeloupe (liste officielle décret 2004-311)
# Toutes les communes de Guadeloupe sauf les communes intérieures
COMMUNES_LITTORALES_971 = {
    "97101",  # Les Abymes
    "97102",  # Anse-Bertrand
    "97103",  # Baie-Mahault
    "97104",  # Baillif
    "97105",  # Basse-Terre
    "97106",  # Bouillante
    "97107",  # Capesterre-Belle-Eau
    "97108",  # Capesterre-de-Marie-Galante
    "97109",  # Deshaies
    "97110",  # Gourbeyre
    "97112",  # Grand-Bourg
    "97113",  # Lamentin
    "97114",  # Le Gosier
    "97115",  # Le Moule
    "97116",  # Morne-à-l'Eau
    "97117",  # Petit-Bourg
    "97118",  # Petit-Canal
    "97120",  # Pointe-à-Pitre
    "97121",  # Pointe-Noire
    "97122",  # Port-Louis
    "97124",  # Saint-François
    "97125",  # Saint-Louis (Marie-Galante)
    "97126",  # Sainte-Anne
    "97127",  # Sainte-Rose
    "97128",  # Terre-de-Bas
    "97129",  # Terre-de-Haut
    "97130",  # Trois-Rivières
    "97131",  # Vieux-Fort
    "97132",  # Vieux-Habitants
}

# Catégories SUP pertinentes pour l'immobilier
SUP_CATEGORIES_CLES = {
    "AC1": "Monument historique — périmètre de protection 500m (avis ABF requis)",
    "AC2": "Site classé ou inscrit (protection paysagère)",
    "AC4": "Zone de protection du patrimoine architectural",
    "AS1": "Périmètre de protection des eaux potables",
    "EL7": "Servitude d'alignement",
    "PM1": "Plan de prévention des risques naturels (PPR)",
    "PM2": "Plan de prévention des risques technologiques",
    "PM3": "Plan de prévention des risques miniers",
    "PT1": "Servitude de télécommunication",
    "PT2": "Servitude hertzienne",
    "T1": "Servitude de voirie",
    "T7": "Servitude aéronautique",
}

# Codes risque Géorisques
CODES_RISQUE = {
    "11": "Inondation",
    "12": "Mouvement de terrain",
    "13": "Séisme",
    "14": "Éruption volcanique",
    "15": "Feu de forêt",
    "16": "Phénomène météorologique",
    "17": "Radon",
    "18": "Cyclone / Ouragan",
}


def log(msg, level="INFO"):
    print(f"[DIAG-REGL] [{level}] {msg}")


def api_get_georisques(endpoint, params=None, retries=RETRY_COUNT):
    """Appel GET à l'API Géorisques avec retry."""
    url = f"{GEORISQUES_BASE}/{endpoint}"
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                log(f"Géorisques HTTP {r.status_code}: {r.text[:200]}", "WARN")
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException as e:
            log(f"Géorisques erreur réseau: {e}", "WARN")
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
    return None


def api_get_gpu(endpoint, params=None, retries=RETRY_COUNT):
    """Appel GET à l'API GPU (apicarto) avec retry."""
    url = f"{GPU_BASE}/{endpoint}"
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                log(f"GPU HTTP {r.status_code}: {r.text[:200]}", "WARN")
                if attempt < retries - 1:
                    time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException as e:
            log(f"GPU erreur réseau: {e}", "WARN")
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
    return None


# ═══════════════════════════════════════════════
# MODULE 1 : GÉORISQUES — PPRN / PPRI
# ═══════════════════════════════════════════════

def fetch_georisques_ppr(code_insee, lat=None, lng=None):
    """
    Récupère les Plans de Prévention des Risques (PPR) pour une commune.

    Retourne les PPR approuvés ou prescrits avec leur type de risque.
    L'API Géorisques ne donne pas le zonage parcellaire précis (rouge/bleue)
    mais indique quels PPR sont en vigueur sur la commune.

    Structure réponse API v1:
    - etat: dict {"code_etat": "02", "libelle_etat": "Approuvé"}
    - risque: dict {"code_risque": "11", "libelle_risque": "Inondation", "classes_alea": [...]}
    - nom_ppr: string
    """
    log(f"Géorisques — Recherche PPR pour INSEE={code_insee}")

    # Stratégie 1 : par code_insee
    params = {"code_insee": code_insee, "page_size": 50}
    data = api_get_georisques("ppr", params)

    # Stratégie 2 : par latlon si pas de résultat et coordonnées disponibles
    if (not data or not data.get("data")) and lat and lng:
        log("  Fallback: recherche PPR par latlon + rayon 10km")
        params = {"latlon": f"{lng},{lat}", "rayon": 10000, "page_size": 50}
        data = api_get_georisques("ppr", params)

    if not data or "data" not in data:
        log("Géorisques PPR: pas de réponse", "WARN")
        return None

    pprs = []
    for item in data.get("data", []):
        # etat est un dict: {"code_etat": "02", "libelle_etat": "Approuvé"}
        etat_raw = item.get("etat", {})
        if isinstance(etat_raw, dict):
            etat_code = etat_raw.get("code_etat", "")
            etat_label = etat_raw.get("libelle_etat", "")
        else:
            etat_code = str(etat_raw)
            etat_label = str(etat_raw)

        # risque est un dict: {"code_risque": "11", "libelle_risque": "Inondation"}
        risque_raw = item.get("risque", {})
        if isinstance(risque_raw, dict):
            code_risque = str(risque_raw.get("code_risque", ""))
            libelle_risque = risque_raw.get("libelle_risque", CODES_RISQUE.get(code_risque, f"Risque {code_risque}"))
        elif isinstance(risque_raw, list):
            code_risque = str(risque_raw[0]) if risque_raw else ""
            libelle_risque = CODES_RISQUE.get(code_risque, f"Risque {code_risque}")
        else:
            code_risque = str(risque_raw)
            libelle_risque = CODES_RISQUE.get(code_risque, f"Risque {code_risque}")

        ppr = {
            "id_gaspar": item.get("id_gaspar", ""),
            "nom": item.get("nom_ppr", item.get("lib_ppr", "")),
            "etat_code": etat_code,
            "etat_label": etat_label,
            "code_risque": code_risque,
            "libelle_risque": libelle_risque,
            "date_approbation": item.get("date_approbation"),
            "risques": [libelle_risque],  # liste pour compatibilité
        }
        pprs.append(ppr)

    log(f"  → {len(pprs)} PPR trouvé(s)")
    return pprs


def fetch_georisques_risques_commune(code_insee):
    """
    Récupère le catalogue des risques connus pour une commune via GASPAR.
    Inclut la zone de sismicité.
    """
    log(f"Géorisques — Catalogue risques commune INSEE={code_insee}")

    params = {"code_insee": code_insee, "page_size": 50}
    data = api_get_georisques("gaspar/risques", params)

    if not data or "data" not in data:
        log("Géorisques risques commune: pas de réponse", "WARN")
        return None

    risques = []
    zone_sismicite = None

    for commune_data in data.get("data", []):
        for detail in commune_data.get("risques_detail", []):
            risques.append({
                "num_risque": detail.get("num_risque"),
                "libelle": detail.get("libelle_risque_long", detail.get("libelle_risque", "")),
            })
        zone_sismicite = commune_data.get("zone_sismicite")

    log(f"  → {len(risques)} risque(s), zone sismicité: {zone_sismicite}")
    return {"risques": risques, "zone_sismicite": zone_sismicite}


def fetch_georisques_rapport(code_insee, lat=None, lng=None):
    """
    Récupère le rapport de risques complet (synthèse).
    Utilise lat/lon si disponible pour plus de précision, sinon code_insee.
    """
    log(f"Géorisques — Rapport risques INSEE={code_insee}")

    params = {"code_insee": code_insee}
    if lat and lng:
        params["latlon"] = f"{lng},{lat}"

    data = api_get_georisques("resultats_rapport_risque", params)

    if not data:
        log("Géorisques rapport: pas de réponse", "WARN")
        return None

    return data


def run_diagnostic_georisques(code_insee, lat=None, lng=None):
    """
    Orchestre le diagnostic Géorisques complet.
    Retourne un dict structuré avec PPR, risques commune, et sismicité.
    """
    result = {
        "source": "Géorisques (georisques.gouv.fr)",
        "code_insee": code_insee,
        "pprs": [],
        "risques_commune": [],
        "zone_sismicite": None,
        "ppr_inondation": False,
        "ppr_mouvement_terrain": False,
        "ppr_cyclone": False,
        "ppr_volcanique": False,
        "nb_pprs_approuves": 0,
        "alerte": None,
    }

    # 1. PPR
    pprs = fetch_georisques_ppr(code_insee, lat, lng)
    if pprs:
        result["pprs"] = pprs
        approuves = [p for p in pprs if p.get("etat_code") in ("02", "04")]
        result["nb_pprs_approuves"] = len(approuves)

        for ppr in pprs:
            risques = ppr.get("risques", [])
            code = ppr.get("code_risque", "")
            # Détection par code_risque (plus fiable) et par libellé (fallback)
            if code == "11" or any("Inondation" in r for r in risques):
                result["ppr_inondation"] = True
            if code == "12" or any("Mouvement" in r for r in risques):
                result["ppr_mouvement_terrain"] = True
            if code == "18" or any("Cyclone" in r or "Ouragan" in r for r in risques):
                result["ppr_cyclone"] = True
            if code == "14" or any("volcan" in r.lower() for r in risques):
                result["ppr_volcanique"] = True

    # 2. Risques commune
    risques_data = fetch_georisques_risques_commune(code_insee)
    if risques_data:
        result["risques_commune"] = risques_data.get("risques", [])
        result["zone_sismicite"] = risques_data.get("zone_sismicite")

    # 3. Synthèse alerte
    alertes = []
    if result["ppr_inondation"]:
        alertes.append("PPR Inondation en vigueur — vérifier le zonage précis en mairie")
    if result["ppr_mouvement_terrain"]:
        alertes.append("PPR Mouvement de terrain en vigueur — vérifier la zone d'aléa")
    if result["ppr_cyclone"]:
        alertes.append("PPR Cyclone en vigueur — normes paracycloniques obligatoires")
    if result["ppr_volcanique"]:
        alertes.append("PPR Volcanique en vigueur — zone à risque éruptif")
    if result["zone_sismicite"] and str(result["zone_sismicite"]) in ("4", "5"):
        alertes.append(f"Zone sismicité {result['zone_sismicite']} — normes parasismiques renforcées")

    result["alertes"] = alertes

    log(f"  → Diagnostic Géorisques terminé: {len(alertes)} alerte(s)")
    return result


# ═══════════════════════════════════════════════
# MODULE 2 : GPU — PRESCRIPTIONS + SUP + ABF
# ═══════════════════════════════════════════════

def fetch_gpu_prescriptions(lat, lng):
    """
    Récupère les prescriptions d'urbanisme (surfaciques + linéaires)
    qui intersectent le point de la parcelle.

    Les prescriptions incluent : emplacements réservés, espaces boisés classés,
    secteurs de mixité sociale, linéaires commerciaux, etc.
    """
    log(f"GPU — Prescriptions au point ({lat:.5f}, {lng:.5f})")

    geom = json.dumps({"type": "Point", "coordinates": [lng, lat]})
    prescriptions = []

    # Prescriptions surfaciques
    data = api_get_gpu("prescription-surf", params={"geom": geom})
    if data and "features" in data:
        for feat in data["features"]:
            props = feat.get("properties", {})
            prescriptions.append({
                "type": "surface",
                "libelle": props.get("libelle", ""),
                "txt": props.get("txt", ""),
                "typepsc": props.get("typepsc", ""),
                "stypepsc": props.get("stypepsc", ""),
                "idurba": props.get("idurba", ""),
            })

    # Prescriptions linéaires
    data = api_get_gpu("prescription-lin", params={"geom": geom})
    if data and "features" in data:
        for feat in data["features"]:
            props = feat.get("properties", {})
            prescriptions.append({
                "type": "lineaire",
                "libelle": props.get("libelle", ""),
                "txt": props.get("txt", ""),
                "typepsc": props.get("typepsc", ""),
                "stypepsc": props.get("stypepsc", ""),
                "idurba": props.get("idurba", ""),
            })

    # Prescriptions ponctuelles
    data = api_get_gpu("prescription-pct", params={"geom": geom})
    if data and "features" in data:
        for feat in data["features"]:
            props = feat.get("properties", {})
            prescriptions.append({
                "type": "ponctuel",
                "libelle": props.get("libelle", ""),
                "txt": props.get("txt", ""),
                "typepsc": props.get("typepsc", ""),
                "stypepsc": props.get("stypepsc", ""),
                "idurba": props.get("idurba", ""),
            })

    log(f"  → {len(prescriptions)} prescription(s) trouvée(s)")
    return prescriptions


def fetch_gpu_informations(lat, lng):
    """
    Récupère les informations d'urbanisme (surfaciques + linéaires)
    qui intersectent le point.

    Les informations incluent : périmètres de projet, secteurs à enjeux,
    zones de bruit, etc.
    """
    log(f"GPU — Informations au point ({lat:.5f}, {lng:.5f})")

    geom = json.dumps({"type": "Point", "coordinates": [lng, lat]})
    informations = []

    for endpoint in ("info-surf", "info-lin", "info-pct"):
        data = api_get_gpu(endpoint, params={"geom": geom})
        if data and "features" in data:
            for feat in data["features"]:
                props = feat.get("properties", {})
                informations.append({
                    "type": endpoint.split("-")[1],  # surf, lin, pct
                    "libelle": props.get("libelle", ""),
                    "txt": props.get("txt", ""),
                    "typeinf": props.get("typeinf", ""),
                    "stypeinf": props.get("stypeinf", ""),
                    "idurba": props.get("idurba", ""),
                })

    log(f"  → {len(informations)} information(s) trouvée(s)")
    return informations


def fetch_gpu_sup(lat, lng):
    """
    Récupère les Servitudes d'Utilité Publique (SUP) qui intersectent le point.
    Couvre : monuments historiques (AC1), sites classés (AC2),
    captages d'eau (AS1), PPR (PM1), etc.

    Structure réponse API GPU:
    - suptype: "ac1" (minuscule, code SUP)
    - typeass: "Monument historique" (libellé humain)
    - nomass: nom de l'assiette
    - partition: "172014607_SUP_75_AC1"
    """
    log(f"GPU — Servitudes (SUP) au point ({lat:.5f}, {lng:.5f})")

    geom = json.dumps({"type": "Point", "coordinates": [lng, lat]})
    servitudes = []

    def parse_sup_feature(feat, sup_type):
        props = feat.get("properties", {})
        # suptype est en minuscule (ex: "ac1"), on le normalise en majuscule
        suptype = (props.get("suptype", "") or "").upper()
        typeass = props.get("typeass", "")
        nomass = props.get("nomass", "")

        # Essayer d'extraire la catégorie depuis suptype ou partition
        categorie = suptype
        if not categorie:
            # Fallback: extraire depuis partition (ex: "172014607_SUP_75_AC1")
            partition = props.get("partition", "")
            parts = partition.split("_")
            if len(parts) >= 4:
                categorie = parts[-1].upper()

        libelle = typeass or SUP_CATEGORIES_CLES.get(categorie, f"SUP {categorie}")

        return {
            "type": sup_type,
            "categorie": categorie,
            "libelle": libelle,
            "nom": nomass,
            "typeass": typeass,
            "id_sup": props.get("idass", props.get("idgen", "")),
            "partition": props.get("partition", ""),
        }

    # Assiettes surfaciques (les plus courantes)
    data = api_get_gpu("assiette-sup-s", params={"geom": geom})
    if data and "features" in data:
        for feat in data["features"]:
            servitudes.append(parse_sup_feature(feat, "surface"))

    # Assiettes linéaires
    data = api_get_gpu("assiette-sup-l", params={"geom": geom})
    if data and "features" in data:
        for feat in data["features"]:
            servitudes.append(parse_sup_feature(feat, "lineaire"))

    # Assiettes ponctuelles
    data = api_get_gpu("assiette-sup-p", params={"geom": geom})
    if data and "features" in data:
        for feat in data["features"]:
            servitudes.append(parse_sup_feature(feat, "ponctuel"))

    log(f"  → {len(servitudes)} servitude(s) trouvée(s)")
    return servitudes


def run_diagnostic_gpu(lat, lng):
    """
    Orchestre le diagnostic GPU complet (prescriptions + informations + SUP).
    """
    result = {
        "source": "Géoportail de l'Urbanisme (GPU via apicarto.ign.fr)",
        "prescriptions": [],
        "informations": [],
        "servitudes": [],
        "abf_requis": False,
        "espace_boise_classe": False,
        "emplacement_reserve": False,
        "alertes": [],
    }

    # 1. Prescriptions
    prescriptions = fetch_gpu_prescriptions(lat, lng)
    result["prescriptions"] = prescriptions

    # Détecter les prescriptions critiques
    for p in prescriptions:
        typepsc = str(p.get("typepsc", ""))
        libelle = (p.get("libelle", "") or "").lower()

        # Espace boisé classé (typepsc 01)
        if typepsc == "01" or "boisé classé" in libelle:
            result["espace_boise_classe"] = True
            result["alertes"].append("Espace Boisé Classé (EBC) — déboisement interdit sans autorisation")

        # Emplacement réservé (typepsc 04)
        if typepsc == "04" or "emplacement réservé" in libelle:
            result["emplacement_reserve"] = True
            result["alertes"].append(f"Emplacement réservé — {p.get('txt', 'vérifier la destination')}")

        # Linéaire commercial (typepsc 09)
        if typepsc == "09":
            result["alertes"].append("Linéaire commercial — obligation de commerce en RDC")

    # 2. Informations
    informations = fetch_gpu_informations(lat, lng)
    result["informations"] = informations

    # 3. SUP
    servitudes = fetch_gpu_sup(lat, lng)
    result["servitudes"] = servitudes

    # Détecter ABF (catégories AC1, AC2, AC4 — ou typeass contenant "monument")
    for s in servitudes:
        cat = s.get("categorie", "").upper()
        typeass = (s.get("typeass", "") or "").lower()
        if cat in ("AC1", "AC2", "AC4") or "monument" in typeass or "classé" in typeass:
            result["abf_requis"] = True
            nom = s.get("nom", "") or s.get("typeass", "")
            result["alertes"].append(
                f"Périmètre ABF ({cat}) — {nom} — avis Architecte des Bâtiments de France requis"
            )

    # Détecter PPR dans les SUP
    for s in servitudes:
        cat = s.get("categorie", "").upper()
        if cat in ("PM1", "PM2", "PM3"):
            result["alertes"].append(f"Servitude {cat} — {s.get('libelle', '')}")

    log(f"  → Diagnostic GPU terminé: {len(result['alertes'])} alerte(s)")
    return result


# ═══════════════════════════════════════════════
# MODULE 3 : LOI LITTORAL
# ═══════════════════════════════════════════════

def estimate_distance_to_coast(lat, lng):
    """
    Estimation grossière de la distance au trait de côte.

    Utilise l'API Géoplateforme (WFS BD TOPO) pour trouver le trait de côte
    le plus proche. Si indisponible, utilise une heuristique géographique
    pour la Guadeloupe.

    Retourne la distance en mètres (ou None si impossible à déterminer).
    """
    log(f"Loi Littoral — Estimation distance côte ({lat:.5f}, {lng:.5f})")

    # Essayer via WFS BD TOPO — limites terrestres / trait de côte
    # Le buffer de recherche est de 500m pour détecter la bande des 100m avec marge
    try:
        # Construire un bbox de ~500m autour du point pour chercher le trait de côte
        buf_deg = 0.005  # ~500m
        # IMPORTANT: format bbox WFS = lon_min,lat_min,lon_max,lat_max,EPSG:4326
        bbox = f"{lng - buf_deg},{lat - buf_deg},{lng + buf_deg},{lat + buf_deg},EPSG:4326"

        url = "https://data.geopf.fr/wfs/ows"
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "BDTOPO_V3:limite_terre_mer",
            "bbox": bbox,
            "outputFormat": "application/json",
            "count": 50,
        }

        r = requests.get(url, params=params, timeout=30)
        if r.status_code == 200:
            data = r.json()
            if data.get("features"):
                # Calculer la distance minimale au trait de côte
                min_dist = float('inf')
                for feat in data["features"]:
                    geom = feat.get("geometry", {})
                    coords = []
                    if geom["type"] == "LineString":
                        coords = geom["coordinates"]
                    elif geom["type"] == "MultiLineString":
                        for line in geom["coordinates"]:
                            coords.extend(line)

                    for c in coords:
                        # Distance approximative en mètres
                        dlat = (c[1] - lat) * 111000
                        dlng = (c[0] - lng) * 111000 * math.cos(math.radians(lat))
                        dist = math.sqrt(dlat**2 + dlng**2)
                        min_dist = min(min_dist, dist)

                if min_dist < float('inf'):
                    log(f"  → Distance côte estimée: {min_dist:.0f}m (via BD TOPO)")
                    return min_dist
    except Exception as e:
        log(f"  Erreur WFS trait de côte: {e}", "WARN")

    log("  → Distance côte non déterminée", "WARN")
    return None


def check_commune_littorale(code_insee):
    """
    Vérifie si la commune est littorale (liste officielle décret 2004-311).
    Pour la Guadeloupe, la quasi-totalité des communes le sont sauf quelques-unes
    de l'intérieur (Goyave est en débat, Saint-Claude est intérieur).
    """
    is_littoral = code_insee in COMMUNES_LITTORALES_971
    log(f"  → Commune {code_insee} littorale: {is_littoral}")
    return is_littoral


def check_espaces_remarquables_gpu(lat, lng):
    """
    Vérifie via les prescriptions GPU si la parcelle est en espace remarquable
    du littoral. Ces espaces sont souvent codifiés dans le PLU via des
    prescriptions surfaciques spécifiques (typepsc 07 ou libellé contenant
    'espace remarquable', 'littoral', 'L121-23').
    """
    log(f"GPU — Recherche espaces remarquables littoral ({lat:.5f}, {lng:.5f})")

    geom = json.dumps({"type": "Point", "coordinates": [lng, lat]})

    # Les espaces remarquables sont souvent dans les prescriptions surf
    data = api_get_gpu("prescription-surf", params={"geom": geom})

    espaces_remarquables = []
    if data and "features" in data:
        for feat in data["features"]:
            props = feat.get("properties", {})
            libelle = (props.get("libelle", "") or "").lower()
            txt = (props.get("txt", "") or "").lower()
            typepsc = str(props.get("typepsc", ""))

            # Détection par typepsc (07 = espaces naturels) ou par mots-clés
            keywords_littoral = [
                "espace remarquable", "littoral", "l121-23", "l.121-23",
                "bande littorale", "100 m", "100m", "coupure d'urbanisation",
                "espace proche du rivage", "l121-16", "l.121-16",
            ]

            is_littoral = typepsc == "07"
            for kw in keywords_littoral:
                if kw in libelle or kw in txt:
                    is_littoral = True
                    break

            if is_littoral:
                espaces_remarquables.append({
                    "libelle": props.get("libelle", ""),
                    "txt": props.get("txt", ""),
                    "typepsc": typepsc,
                })

    # Vérifier aussi dans les zones du PLU (zone N avec mention littoral)
    data = api_get_gpu("zone-urba", params={"geom": geom})
    if data and "features" in data:
        for feat in data["features"]:
            props = feat.get("properties", {})
            libelong = (props.get("libelong", "") or "").lower()
            libelle = (props.get("libelle", "") or "").lower()

            keywords = ["littoral", "remarquable", "rivage", "l121"]
            for kw in keywords:
                if kw in libelong or kw in libelle:
                    espaces_remarquables.append({
                        "libelle": props.get("libelle", ""),
                        "txt": props.get("libelong", ""),
                        "typepsc": f"zone_{props.get('typezone', '?')}",
                    })
                    break

    log(f"  → {len(espaces_remarquables)} espace(s) remarquable(s) trouvé(s)")
    return espaces_remarquables


def run_diagnostic_littoral(code_insee, lat, lng):
    """
    Orchestre le diagnostic Loi Littoral complet.
    """
    result = {
        "source": "Analyse Loi Littoral (L121-1 et suivants du Code de l'urbanisme)",
        "commune_littorale": False,
        "distance_cote_m": None,
        "dans_bande_100m": False,
        "espace_remarquable": False,
        "espaces_remarquables_detail": [],
        "coupure_urbanisation": False,
        "espace_proche_rivage": False,
        "alertes": [],
    }

    # 1. Commune littorale ?
    result["commune_littorale"] = check_commune_littorale(code_insee)

    if not result["commune_littorale"]:
        log("  → Commune non littorale, diagnostic Loi Littoral non applicable")
        return result

    # 2. Distance au trait de côte
    dist = estimate_distance_to_coast(lat, lng)
    result["distance_cote_m"] = dist

    if dist is not None:
        if dist <= 100:
            result["dans_bande_100m"] = True
            result["alertes"].append(
                f"BLOQUANT — Parcelle dans la bande des 100m du littoral ({dist:.0f}m) — "
                "construction interdite hors espace urbanisé (art. L121-16)"
            )
        elif dist <= 300:
            result["espace_proche_rivage"] = True
            result["alertes"].append(
                f"Espace proche du rivage ({dist:.0f}m) — extension limitée de l'urbanisation "
                "(art. L121-13)"
            )

    # 3. Espaces remarquables (via GPU)
    espaces = check_espaces_remarquables_gpu(lat, lng)
    result["espaces_remarquables_detail"] = espaces
    if espaces:
        result["espace_remarquable"] = True
        result["alertes"].append(
            f"Espace remarquable du littoral détecté ({len(espaces)} zone(s)) — "
            "construction très strictement encadrée (art. L121-23)"
        )

    log(f"  → Diagnostic Littoral terminé: {len(result['alertes'])} alerte(s)")
    return result


# ═══════════════════════════════════════════════
# ORCHESTRATEUR PRINCIPAL
# ═══════════════════════════════════════════════

def run_diagnostic_reglementaire(code_insee, lat, lng):
    """
    Lance les 3 modules de diagnostic réglementaire et produit une synthèse.

    Args:
        code_insee (str): Code INSEE de la commune (ex: "97105")
        lat (float): Latitude du centroïde de la parcelle
        lng (float): Longitude du centroïde de la parcelle

    Returns:
        dict: Diagnostic complet avec synthèse, alertes, et flag bloquant
    """
    log("=" * 60)
    log("DIAGNOSTIC RÉGLEMENTAIRE — Lancement des 3 modules")
    log("=" * 60)

    diagnostic = {
        "georisques": None,
        "gpu": None,
        "littoral": None,
        "synthese": {
            "bloquant": False,
            "alertes_bloquantes": [],
            "vigilances": [],
            "nb_total_alertes": 0,
        }
    }

    # Module 1 : Géorisques
    try:
        diagnostic["georisques"] = run_diagnostic_georisques(code_insee, lat, lng)
    except Exception as e:
        log(f"Module Géorisques en erreur: {e}", "ERROR")
        diagnostic["georisques"] = {"erreur": str(e), "alertes": []}

    # Module 2 : GPU Prescriptions + SUP
    try:
        diagnostic["gpu"] = run_diagnostic_gpu(lat, lng)
    except Exception as e:
        log(f"Module GPU en erreur: {e}", "ERROR")
        diagnostic["gpu"] = {"erreur": str(e), "alertes": []}

    # Module 3 : Loi Littoral
    try:
        diagnostic["littoral"] = run_diagnostic_littoral(code_insee, lat, lng)
    except Exception as e:
        log(f"Module Littoral en erreur: {e}", "ERROR")
        diagnostic["littoral"] = {"erreur": str(e), "alertes": []}

    # ─── Synthèse ───
    all_alertes = []
    for module_key in ("georisques", "gpu", "littoral"):
        module = diagnostic.get(module_key, {})
        if module and isinstance(module, dict):
            all_alertes.extend(module.get("alertes", []))

    bloquantes = [a for a in all_alertes if "BLOQUANT" in a.upper()]
    vigilances = [a for a in all_alertes if "BLOQUANT" not in a.upper()]

    diagnostic["synthese"] = {
        "bloquant": len(bloquantes) > 0,
        "alertes_bloquantes": bloquantes,
        "vigilances": vigilances,
        "nb_total_alertes": len(all_alertes),
    }

    log("=" * 60)
    log(f"DIAGNOSTIC TERMINÉ — {len(all_alertes)} alerte(s), {len(bloquantes)} bloquante(s)")
    log("=" * 60)

    return diagnostic


# ═══════════════════════════════════════════════
# FORMATAGE POUR INTÉGRATION
# ═══════════════════════════════════════════════

def diagnostic_to_terrain_data_js(diagnostic):
    """
    Convertit le diagnostic en format compatible terrain_data.js
    pour injection dans la section meta de TERRAIN_DATA.
    """
    return {
        "pprn": {
            "existe": bool(diagnostic.get("georisques", {}).get("pprs")),
            "nb_pprs": diagnostic.get("georisques", {}).get("nb_pprs_approuves", 0),
            "inondation": diagnostic.get("georisques", {}).get("ppr_inondation", False),
            "mouvement_terrain": diagnostic.get("georisques", {}).get("ppr_mouvement_terrain", False),
            "cyclone": diagnostic.get("georisques", {}).get("ppr_cyclone", False),
            "volcanique": diagnostic.get("georisques", {}).get("ppr_volcanique", False),
            "zone_sismicite": diagnostic.get("georisques", {}).get("zone_sismicite"),
        },
        "loi_littoral": {
            "commune_littorale": diagnostic.get("littoral", {}).get("commune_littorale", False),
            "bande_100m": diagnostic.get("littoral", {}).get("dans_bande_100m", False),
            "espace_remarquable": diagnostic.get("littoral", {}).get("espace_remarquable", False),
            "espace_proche_rivage": diagnostic.get("littoral", {}).get("espace_proche_rivage", False),
            "distance_cote_m": diagnostic.get("littoral", {}).get("distance_cote_m"),
        },
        "servitudes": [
            {
                "categorie": s.get("categorie", ""),
                "libelle": s.get("libelle", ""),
            }
            for s in diagnostic.get("gpu", {}).get("servitudes", [])
        ],
        "prescriptions_count": len(diagnostic.get("gpu", {}).get("prescriptions", [])),
        "abf_requis": diagnostic.get("gpu", {}).get("abf_requis", False),
        "espace_boise_classe": diagnostic.get("gpu", {}).get("espace_boise_classe", False),
        "synthese": diagnostic.get("synthese", {}),
    }


def diagnostic_to_rapport_md(diagnostic):
    """
    Génère la section Markdown du diagnostic réglementaire
    à insérer dans rapport.md.
    """
    lines = [
        "",
        "## Diagnostic Réglementaire",
        "",
    ]

    synthese = diagnostic.get("synthese", {})

    # Statut global
    if synthese.get("bloquant"):
        lines.append("**⛔ ALERTE — Contrainte(s) bloquante(s) détectée(s)**")
        lines.append("")
        for a in synthese.get("alertes_bloquantes", []):
            lines.append(f"- {a}")
        lines.append("")
    else:
        lines.append("**Aucune contrainte bloquante détectée.**")
        lines.append("")

    # Vigilances
    vigilances = synthese.get("vigilances", [])
    if vigilances:
        lines.append("### Points de vigilance")
        lines.append("")
        for v in vigilances:
            lines.append(f"- {v}")
        lines.append("")

    # Détail Géorisques
    geo = diagnostic.get("georisques", {})
    if geo and not geo.get("erreur"):
        lines.append("### Risques naturels (Géorisques)")
        lines.append("")
        lines.append(f"| Paramètre | Valeur |")
        lines.append(f"|---|---|")
        lines.append(f"| PPR Inondation | {'Oui' if geo.get('ppr_inondation') else 'Non'} |")
        lines.append(f"| PPR Mouvement de terrain | {'Oui' if geo.get('ppr_mouvement_terrain') else 'Non'} |")
        lines.append(f"| PPR Cyclone | {'Oui' if geo.get('ppr_cyclone') else 'Non'} |")
        lines.append(f"| Zone sismicité | {geo.get('zone_sismicite', 'N/A')} |")
        lines.append(f"| Nb PPR approuvés | {geo.get('nb_pprs_approuves', 0)} |")
        lines.append("")

        pprs = geo.get("pprs", [])
        if pprs:
            lines.append("**Détail des PPR :**")
            lines.append("")
            for ppr in pprs:
                nom = ppr.get("nom", "PPR sans nom")
                etat = ppr.get("etat", "?")
                risques = ", ".join(ppr.get("risques", []))
                lines.append(f"- **{nom}** — État: {etat} — Risques: {risques}")
            lines.append("")

    # Détail GPU
    gpu = diagnostic.get("gpu", {})
    if gpu and not gpu.get("erreur"):
        lines.append("### Servitudes et prescriptions (GPU)")
        lines.append("")
        lines.append(f"| Paramètre | Valeur |")
        lines.append(f"|---|---|")
        lines.append(f"| Avis ABF requis | {'Oui' if gpu.get('abf_requis') else 'Non'} |")
        lines.append(f"| Espace Boisé Classé | {'Oui' if gpu.get('espace_boise_classe') else 'Non'} |")
        lines.append(f"| Emplacement réservé | {'Oui' if gpu.get('emplacement_reserve') else 'Non'} |")
        lines.append(f"| Nb prescriptions | {len(gpu.get('prescriptions', []))} |")
        lines.append(f"| Nb servitudes (SUP) | {len(gpu.get('servitudes', []))} |")
        lines.append("")

        servitudes = gpu.get("servitudes", [])
        if servitudes:
            lines.append("**Servitudes détectées :**")
            lines.append("")
            for s in servitudes:
                lines.append(f"- [{s.get('categorie', '?')}] {s.get('libelle', '')}")
            lines.append("")

    # Détail Littoral
    litt = diagnostic.get("littoral", {})
    if litt and not litt.get("erreur"):
        lines.append("### Loi Littoral")
        lines.append("")
        lines.append(f"| Paramètre | Valeur |")
        lines.append(f"|---|---|")
        lines.append(f"| Commune littorale | {'Oui' if litt.get('commune_littorale') else 'Non'} |")
        dist = litt.get("distance_cote_m")
        lines.append(f"| Distance côte estimée | {f'{dist:.0f}m' if dist else 'Non déterminée'} |")
        lines.append(f"| Bande des 100m | {'OUI' if litt.get('dans_bande_100m') else 'Non'} |")
        lines.append(f"| Espace remarquable | {'OUI' if litt.get('espace_remarquable') else 'Non'} |")
        lines.append(f"| Espace proche rivage | {'Oui' if litt.get('espace_proche_rivage') else 'Non'} |")
        lines.append("")

    # Sources
    lines.extend([
        "### Sources du diagnostic",
        "",
        "- **Géorisques** : [georisques.gouv.fr](https://www.georisques.gouv.fr/) — API GASPAR v1",
        "- **GPU** : [Géoportail de l'Urbanisme](https://www.geoportail-urbanisme.gouv.fr/) — API Carto IGN",
        "- **Loi Littoral** : Liste officielle communes littorales (décret 2004-311) + BD TOPO trait de côte",
        "",
        "*Note : le zonage PPRN précis (rouge/bleue/orange) par parcelle n'est pas disponible via l'API Géorisques.*",
        "*Pour le zonage exact, consulter la cartographie du PPR en mairie ou sur le Géoportail de l'Urbanisme.*",
        "",
    ])

    return "\n".join(lines)


def diagnostic_to_metadata_json(diagnostic):
    """
    Retourne le bloc JSON à fusionner dans metadata.json.
    """
    return {
        "diagnostic_reglementaire": {
            "bloquant": diagnostic.get("synthese", {}).get("bloquant", False),
            "nb_alertes": diagnostic.get("synthese", {}).get("nb_total_alertes", 0),
            "alertes_bloquantes": diagnostic.get("synthese", {}).get("alertes_bloquantes", []),
            "vigilances": diagnostic.get("synthese", {}).get("vigilances", []),
            "georisques": {
                "ppr_inondation": diagnostic.get("georisques", {}).get("ppr_inondation", False),
                "ppr_mouvement_terrain": diagnostic.get("georisques", {}).get("ppr_mouvement_terrain", False),
                "ppr_cyclone": diagnostic.get("georisques", {}).get("ppr_cyclone", False),
                "zone_sismicite": diagnostic.get("georisques", {}).get("zone_sismicite"),
                "nb_pprs": diagnostic.get("georisques", {}).get("nb_pprs_approuves", 0),
            },
            "gpu": {
                "abf_requis": diagnostic.get("gpu", {}).get("abf_requis", False),
                "espace_boise_classe": diagnostic.get("gpu", {}).get("espace_boise_classe", False),
                "emplacement_reserve": diagnostic.get("gpu", {}).get("emplacement_reserve", False),
                "nb_prescriptions": len(diagnostic.get("gpu", {}).get("prescriptions", [])),
                "nb_servitudes": len(diagnostic.get("gpu", {}).get("servitudes", [])),
            },
            "littoral": {
                "commune_littorale": diagnostic.get("littoral", {}).get("commune_littorale", False),
                "bande_100m": diagnostic.get("littoral", {}).get("dans_bande_100m", False),
                "espace_remarquable": diagnostic.get("littoral", {}).get("espace_remarquable", False),
                "distance_cote_m": diagnostic.get("littoral", {}).get("distance_cote_m"),
            },
            "sources": [
                "Géorisques API v1 (georisques.gouv.fr)",
                "GPU API Carto (apicarto.ign.fr)",
                "BD TOPO IGN (trait de côte)",
                "Liste communes littorales décret 2004-311",
            ],
        }
    }
