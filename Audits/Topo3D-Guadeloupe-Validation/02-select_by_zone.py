#!/usr/bin/env python3
"""
Sélecteur d'extraits par zone — Filtre les parcelles de l'index.json
par commune, bbox, ou rayon autour d'un point.

Usage:
    # Par commune
    python 02-select_by_zone.py --index extraits/index.json --commune "Baie-Mahault"

    # Par bounding box (min_lat,min_lng,max_lat,max_lng)
    python 02-select_by_zone.py --index extraits/index.json --bbox 16.0,61.7,16.3,-61.5

    # Par rayon autour d'un point (lat,lng,rayon_km)
    python 02-select_by_zone.py --index extraits/index.json --radius 16.25,-61.53,5

    # Par statut
    python 02-select_by_zone.py --index extraits/index.json --status ok

    # Par dénivelé minimum
    python 02-select_by_zone.py --index extraits/index.json --min-denivele 10

    # Combiné
    python 02-select_by_zone.py --index extraits/index.json --commune "Petit-Bourg" --status ok --output selection.json

    # Lancer la génération uniquement sur la sélection
    python 02-select_by_zone.py --index extraits/index.json --bbox 16.0,-61.8,16.2,-61.6 --generate --output-dir ./selection_extraits/
"""

import argparse
import json
import math
import os
import sys


def load_index(path):
    with open(path, 'r') as f:
        return json.load(f)


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def filter_by_commune(data, commune):
    commune_lower = commune.lower()
    return [d for d in data if commune_lower in d.get("name", "").lower()]


def filter_by_bbox(data, min_lat, min_lng, max_lat, max_lng):
    return [d for d in data
            if min_lat <= d["lat"] <= max_lat and min_lng <= d["lng"] <= max_lng]


def filter_by_radius(data, center_lat, center_lng, radius_km):
    return [d for d in data
            if haversine_km(center_lat, center_lng, d["lat"], d["lng"]) <= radius_km]


def filter_by_status(data, status):
    return [d for d in data if d.get("status") == status]


def filter_by_denivele(data, min_deniv):
    return [d for d in data
            if d.get("z_max") and d.get("z_min") and (d["z_max"] - d["z_min"]) >= min_deniv]


def filter_by_trees(data, min_trees):
    return [d for d in data if d.get("trees", 0) >= min_trees]


def print_results(data, verbose=True):
    print(f"\n{'='*70}")
    print(f"  {len(data)} parcelle(s) sélectionnée(s)")
    print(f"{'='*70}")

    if not data:
        print("  Aucun résultat.")
        return

    for d in data:
        status = d.get("status", "?").upper()
        deniv = f"{d['z_max']-d['z_min']:.1f}m" if d.get("z_max") and d.get("z_min") else "?"
        trees = d.get("trees", "?")
        print(f"  [{d.get('id', '?'):>2}] {d['name']:<35} | "
              f"Alt: {d.get('z_min', '?')}-{d.get('z_max', '?')}m | "
              f"Déniv: {deniv} | Arbres: {trees} | {status}")

    if verbose:
        ok = sum(1 for d in data if d.get("status") == "ok")
        err = sum(1 for d in data if d.get("status") == "error")
        total_trees = sum(d.get("trees", 0) for d in data)
        print(f"\n  Résumé: {ok} OK / {err} erreurs / {total_trees} arbres au total")


def main():
    parser = argparse.ArgumentParser(description="Sélecteur d'extraits topo par zone")
    parser.add_argument("--index", required=True, help="Chemin vers index.json")
    parser.add_argument("--commune", help="Filtrer par nom de commune")
    parser.add_argument("--bbox", help="Bounding box: min_lat,min_lng,max_lat,max_lng")
    parser.add_argument("--radius", help="Rayon: lat,lng,rayon_km")
    parser.add_argument("--status", help="Filtrer par statut (ok/error/pending)")
    parser.add_argument("--min-denivele", type=float, help="Dénivelé minimum en mètres")
    parser.add_argument("--min-trees", type=int, help="Nombre minimum d'arbres")
    parser.add_argument("--output", help="Sauver la sélection dans un fichier JSON")
    parser.add_argument("--generate", action="store_true",
                        help="Lancer la génération sur les parcelles sélectionnées")
    parser.add_argument("--output-dir", default="./selection_extraits/",
                        help="Dossier de sortie pour --generate")

    args = parser.parse_args()

    data = load_index(args.index)
    print(f"Chargé: {len(data)} parcelles depuis {args.index}")

    if args.commune:
        data = filter_by_commune(data, args.commune)
        print(f"  → Filtre commune '{args.commune}': {len(data)} résultats")

    if args.bbox:
        parts = [float(x) for x in args.bbox.split(",")]
        data = filter_by_bbox(data, *parts)
        print(f"  → Filtre bbox: {len(data)} résultats")

    if args.radius:
        parts = [float(x) for x in args.radius.split(",")]
        data = filter_by_radius(data, *parts)
        print(f"  → Filtre rayon {parts[2]}km: {len(data)} résultats")

    if args.status:
        data = filter_by_status(data, args.status)
        print(f"  → Filtre statut '{args.status}': {len(data)} résultats")

    if args.min_denivele:
        data = filter_by_denivele(data, args.min_denivele)
        print(f"  → Filtre dénivelé ≥{args.min_denivele}m: {len(data)} résultats")

    if args.min_trees:
        data = filter_by_trees(data, args.min_trees)
        print(f"  → Filtre arbres ≥{args.min_trees}: {len(data)} résultats")

    print_results(data)

    if args.output:
        with open(args.output, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\nSélection sauvée: {args.output}")

    if args.generate:
        print(f"\nLancement de la génération pour {len(data)} parcelles...")
        import subprocess
        for d in data:
            cmd = [
                sys.executable, "01-batch_generate_50.py",
                "--output", args.output_dir,
                "--max", "1",
                "--start", str(d.get("id", 1) - 1),
            ]
            print(f"  → {d['name']}...")
            subprocess.run(cmd, check=False)


if __name__ == "__main__":
    main()
