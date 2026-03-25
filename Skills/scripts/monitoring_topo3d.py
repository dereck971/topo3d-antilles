#!/usr/bin/env python3
"""
CQ-6 — Monitoring automatisé Topo3D
Test quotidien sur 10 parcelles de référence (5 GP + 5 MQ).
Alerte si taux PASS < 90%.

Usage:
    python monitoring_topo3d.py
    python monitoring_topo3d.py --email contact@immoservices971.com
"""

import json
import time
import sys
import argparse
import requests
from datetime import datetime

API_CADASTRE = "https://apicarto.ign.fr/api/cadastre/parcelle"
API_ALTI = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"

# 10 parcelles de référence stables (validées par le QC)
PARCELLES_REF = [
    # Guadeloupe (5)
    {"commune": "Les Abymes", "code": "97101", "section": "AB", "numero": "0010"},
    {"commune": "Basse-Terre", "code": "97105", "section": "AC", "numero": "0010"},
    {"commune": "Le Gosier", "code": "97114", "section": "AC", "numero": "0001"},
    {"commune": "Pointe-à-Pitre", "code": "97119", "section": "AC", "numero": "0001"},
    {"commune": "Trois-Rivières", "code": "97129", "section": "AB", "numero": "0010"},
    # Martinique (5)
    {"commune": "Fort-de-France", "code": "97209", "section": "0A", "numero": "0010"},
    {"commune": "Le François", "code": "97210", "section": "0A", "numero": "0010"},
    {"commune": "Le Robert", "code": "97222", "section": "0A", "numero": "0010"},
    {"commune": "Trinité", "code": "97230", "section": "0A", "numero": "0010"},
    {"commune": "Ducos", "code": "97207", "section": "0A", "numero": "0010"},
]


def test_parcelle(p):
    """Teste une parcelle : cadastre + altimétrie."""
    result = {
        "commune": p["commune"],
        "code": p["code"],
        "ref": f"{p['section']}-{p['numero']}",
        "cadastre_ok": False,
        "alti_ok": False,
        "status": "FAIL",
        "details": "",
        "time_s": 0,
    }
    start = time.time()

    # Test cadastre
    try:
        r = requests.get(API_CADASTRE, params={
            "code_insee": p["code"],
            "section": p["section"],
            "numero": p["numero"],
        }, timeout=15)
        if r.status_code == 200:
            data = r.json()
            features = data.get("features", [])
            if features:
                result["cadastre_ok"] = True
                # Extraire un point pour tester l'altimétrie
                geom = features[0]["geometry"]
                coords = geom["coordinates"]
                if geom["type"] == "MultiPolygon":
                    coords = coords[0]
                pt = coords[0][0]  # Premier point du contour

                # Test altimétrie
                try:
                    r2 = requests.get(API_ALTI, params={
                        "lon": f"{pt[0]:.6f}",
                        "lat": f"{pt[1]:.6f}",
                        "resource": "ign_rge_alti_wld",
                        "zonly": "false",
                    }, timeout=10)
                    if r2.status_code == 200:
                        data2 = r2.json()
                        elevs = data2.get("elevations", [])
                        if elevs:
                            z = elevs[0].get("z", -99999)
                            if abs(z) < 90000:
                                result["alti_ok"] = True
                                result["details"] = f"alt={z:.1f}m"
                            else:
                                result["details"] = f"alt aberrante={z}"
                except Exception as e:
                    result["details"] = f"alti_err: {e}"
            else:
                result["details"] = "parcelle non trouvée"
    except Exception as e:
        result["details"] = f"cadastre_err: {e}"

    result["time_s"] = round(time.time() - start, 2)
    if result["cadastre_ok"] and result["alti_ok"]:
        result["status"] = "PASS"
    elif result["cadastre_ok"]:
        result["status"] = "WARN"

    return result


def main():
    parser = argparse.ArgumentParser(description="Monitoring Topo3D")
    parser.add_argument("--email", help="Email pour les alertes")
    parser.add_argument("--json", help="Sauvegarder les résultats en JSON")
    args = parser.parse_args()

    print(f"{'='*60}")
    print(f"MONITORING TOPO3D — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    results = []
    pass_count = 0

    for i, p in enumerate(PARCELLES_REF, 1):
        print(f"[{i:2d}/{len(PARCELLES_REF)}] {p['commune']:20s} {p['section']}-{p['numero']}...", end=" ", flush=True)
        r = test_parcelle(p)
        results.append(r)
        icon = "✓" if r["status"] == "PASS" else ("⚠" if r["status"] == "WARN" else "✗")
        print(f"{icon} {r['status']} ({r['time_s']}s) {r['details']}")
        if r["status"] == "PASS":
            pass_count += 1

    # Résumé
    total = len(PARCELLES_REF)
    taux = pass_count / total * 100
    print(f"\n{'='*60}")
    print(f"RÉSULTAT : {pass_count}/{total} PASS ({taux:.0f}%)")

    if taux < 90:
        print(f"⚠️  ALERTE : Taux PASS < 90% — Vérification requise !")
        if args.email:
            print(f"  → Envoi d'alerte à {args.email} (non implémenté)")
    else:
        print(f"✓ Tous les indicateurs sont au vert.")

    # Sauvegarder
    output = {
        "date": datetime.now().isoformat(),
        "taux_pass": taux,
        "pass": pass_count,
        "total": total,
        "alerte": taux < 90,
        "resultats": results,
    }

    if args.json:
        with open(args.json, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"Résultats sauvegardés : {args.json}")

    # Toujours sauvegarder dans le dossier courant
    import os
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "monitoring_logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"monitoring_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(log_file, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    return 0 if taux >= 90 else 1


if __name__ == "__main__":
    sys.exit(main())
