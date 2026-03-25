# TOPO3D ANTILLES — PLAN DE LANCEMENT J-9
## Objectif : Lancement officiel le 1er avril 2026
## Version bilingue FR/EN + Pricing revalorisé + Ambition Caraïbes

**Date** : 23 mars 2026
**Auteur** : Dereck Rauzduel — Architecte EPFL
**Statut** : VALIDÉ — Exécution immédiate

---

## 1. DÉCISION STRATÉGIQUE : REVALORISATION PRICING

### Constat
Le pricing actuel (29/69/149€) est **90-97% moins cher** qu'un géomètre (800-3 000€).
C'est tellement bas que les professionnels risquent de douter de la qualité.

### Benchmark concurrentiel
| Concurrent | Prix | Couverture DOM |
|---|---|---|
| Géomètre classique (GP) | 800 - 3 000€ | ✅ |
| Pix4D Cloud | 259€/mois | ❌ |
| DroneDeploy (US) | $299-$499/mois | ❌ |
| SimActive (Canada) | $5,000+ licence | ❌ |
| Propeller Aero | ~$499/mois | ❌ |
| CADmapper | $9/6km² | ❌ DOM |
| TopoExport | Gratuit | ❌ DOM |
| **Topo3D (nouveau)** | **59-249€** | **✅ SEUL** |

### Nouveau pricing

| Offre | Ancien | **Nouveau** | Δ | Justification |
|---|---|---|---|---|
| Fiche Parcelle | 15€ | **19€** | +27% | Impulse buy, toujours < 20€ |
| Essentiel | 29€ | **59€** | +103% | Crédibilise le produit aux yeux des pros |
| Complet ⭐ | 69€ | **129€** | +87% | Sweet spot : 75-93% < géomètre |
| Premium | 149€ | **249€** | +67% | Multi-format BIM, justifié par IFC/DWG |
| Pro mensuel | 199€ | **349€** | +75% | Aligné Pix4D/DroneDeploy mais couverture DOM |
| Pro annuel | — | **2 990€** | NEW | Lock-in 12 mois, remise 29% |

---

## 2. EXPANSION CARAÏBES — MARCHÉ ÉLARGI

### Marché cible par territoire

| Territoire | Prospects estimés | Langue | APIs dispo | Timeline |
|---|---|---|---|---|
| Guadeloupe (971) | 485 | FR | IGN ✅ | J-Day |
| Martinique (972) | 350 | FR | IGN ✅ | J-Day |
| Guyane (973) | 150 | FR | IGN ✅ | Avril 2026 |
| Saint-Martin / Saint-Barth | 80 | FR/EN | IGN ✅ | Avril 2026 |
| Trinidad & Tobago | 200 | EN | SRTM | Q3 2026 |
| Barbados | 100 | EN | SRTM | Q3 2026 |
| Dominica / St Lucia / Grenada | 150 | EN/FR | SRTM | Q3 2026 |
| Jamaica | 300 | EN | SRTM | Q4 2026 |
| Haïti / Rép. Dominicaine | 400 | FR/ES/EN | SRTM | Q4 2026 |
| **TOTAL** | **~2 215** | | | |

### Projections CA sur 3 ans (pricing revalorisé)

| | Année 1 (2026) | Année 2 (2027) | Année 3 (2028) | Total 3 ans |
|---|---|---|---|---|
| Marché couvert | GP + MQ | + Guyane, StM | Caraïbes élargie | — |
| Prospects | 835 | 1 065 | 2 215 | — |
| Clients acquis | 88 | 184 | 573 | 845 |
| **CA TOTAL** | **127 219€** | **243 840€** | **760 708€** | **1 131 767€** |
| Coûts totaux | 2 775€ | 3 816€ | 8 076€ | 14 667€ |
| **Marge brute** | **124 444€** | **240 024€** | **752 632€** | **1 117 100€** |
| Taux de marge | 97.8% | 98.4% | 98.9% | 98.7% |

### Hypothèses conservatrices
- Taux conversion An 1 : 3-6% (vs 5-8% prévisionnel initial)
- Croissance annuelle conversion : 50% (notoriété + SEO + bouche-à-oreille)
- Coût variable : 3€/génération (APIs + compute)
- Charges fixes : 150€/mois (hébergement + domaines)

---

## 3. VERSION ANGLOPHONE — DÈS LE LANCEMENT

### Pourquoi maintenant (pas plus tard)
1. **~750 prospects anglophones** dans les Caraïbes (Trinidad, Barbados, Jamaica, etc.)
2. **Crédibilité internationale** : un site bilingue positionne Topo3D comme un acteur régional, pas juste local
3. **SEO anglophone** : "3D topography Caribbean", "terrain model Guadeloupe" = 0 concurrence
4. **Investisseurs étrangers** : Beaucoup d'investisseurs anglophones achètent en Guadeloupe/Martinique (Airbnb, résidences secondaires)
5. **Coût marginal** : le site est one-page, la traduction = 2-3h de travail

### Implémentation technique
- Toggle FR/EN dans la nav (drapeau ou bouton "EN | FR")
- `data-i18n` attributes sur les textes, fichier `translations.json`
- URL : `/en/` ou paramètre `?lang=en`
- Hreflang tags pour le SEO (`fr-GP`, `en`)
- Email templates bilingues (Resend)

---

## 4. PLAN D'ACTION J-9 → J-DAY

### PHASE 1 — DÉBLOCAGES CRITIQUES (23-25 mars)

| # | Action | Durée | Priorité |
|---|---|---|---|
| 1.1 | Redéployer code corrigé sur Vercel (3 bugs fixés) | 5 min | 🔴 BLOQUANT |
| 1.2 | Configurer DNS topo3d-antilles.com (A + CNAME) | 10 min | 🔴 BLOQUANT |
| 1.3 | Ajouter hero-topo3d.webp (fond hero manquant) | 15 min | 🔴 BLOQUANT |
| 1.4 | Unifier nouveau pricing (19/59/129/249/349€) partout | 1h | 🔴 BLOQUANT |
| 1.5 | Créer 6 Stripe Payment Links + brancher CTA | 30 min | 🔴 BLOQUANT |
| 1.6 | Mentions légales / CGV (page dédiée) | 1h | 🟡 LÉGAL |

### PHASE 2 — CONVERSION & BILINGUE (26-28 mars)

| # | Action | Durée | Priorité |
|---|---|---|---|
| 2.1 | 🌍 Version anglophone du site (toggle FR/EN) | 3h | 🟠 STRATÉGIQUE |
| 2.2 | Ajouter visuels livrables (screenshots 3D du rendu) | 1h | 🟠 CONVERSION |
| 2.3 | Section "Seul sur les DOM-TOM" + comparatif | 1h | 🟠 CONVERSION |
| 2.4 | Menu hamburger mobile | 30 min | 🟠 UX |
| 2.5 | Formulaire capture email (lead magnet terrain démo) | 1h | 🟡 ACQUISITION |
| 2.6 | Section témoignages (3 profils beta anonymisés) | 30 min | 🟡 TRUST |

### PHASE 3 — POLISH & TESTS (29-31 mars)

| # | Action | Durée | Priorité |
|---|---|---|---|
| 3.1 | Google Analytics ou Plausible | 15 min | 🟡 MESURE |
| 3.2 | Tester workflow complet (carte → Stripe → PDF → email) | 2h | 🟡 QA |
| 3.3 | Vérifier domaine Resend (commandes@topo3d-antilles.com) | 15 min | 🟡 EMAIL |
| 3.4 | OG tags + favicon brandé | 30 min | 🟢 POLISH |
| 3.5 | Rédiger email campagne archis (150 GP + 100 MQ) | 2h | 🟡 ACQUISITION |
| 3.6 | Test mobile sur 3 tailles (375px, 390px, 768px) | 30 min | 🟡 QA |

### J-DAY — 1er AVRIL 2026

| # | Action |
|---|---|
| 4.1 | ✉️ Envoyer campagne email 250 architectes (GP + MQ) |
| 4.2 | 📝 Post LinkedIn avec capture vidéo 3D |
| 4.3 | 📊 Dashboard Stripe + Analytics = suivi en temps réel |
| 4.4 | 🎯 Objectif : 3-5 premiers clients payants la première semaine |

### POST-LANCEMENT (avril-mai 2026)

| Semaine | Actions |
|---|---|
| S+1 | Analyser premiers retours, ajuster UX, relance non-ouverts |
| S+2 | 5 articles blog SEO + Google Business Profile |
| S+3 | Extension Guyane (973) + Saint-Martin |
| S+4 | Début prospection îles anglophones |
| M+2 | Page API + developer docs |
| M+3 | Plugin SketchUp (beta) |

---

## 5. RISQUES ET MITIGATIONS

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Stripe pas validé à temps | 20% | 🔴 Bloquant | Formulaire Tally.so en backup (capture commande → traitement manuel) |
| DNS pas propagé | 10% | 🟡 Moyen | topo3d-antilles.vercel.app fonctionne en fallback |
| 0 conversion semaine 1 | 30% | 🟡 Moyen | Offrir 3-5 rapports gratuits aux architectes clés = social proof |
| Pricing trop élevé | 15% | 🟡 Moyen | Coupon "LANCEMENT" -30% les 30 premiers jours |
| Bug critique post-launch | 25% | 🟠 Élevé | Mode beta actif, monitoring, rollback Vercel en 30s |

---

## 6. MÉTRIQUES DE SUCCÈS

| Métrique | J+7 | J+30 | J+90 |
|---|---|---|---|
| Visiteurs uniques | 100 | 500 | 2 000 |
| Taux de conversion | 2% | 3% | 5% |
| Clients payants | 3-5 | 15-20 | 40-50 |
| CA cumulé | 500€ | 3 000€ | 15 000€ |
| NPS (satisfaction) | — | 7+ | 8+ |

---

*Document généré le 23 mars 2026 — Topo3D Antilles*
*Dereck Rauzduel — Architecte EPFL — Guadeloupe*
*Mis à jour sur Notion : Journal Écosystème + To-Do Lancement + Fiche Topo3D*
