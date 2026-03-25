# Prompts Gemini Validés — Rendus Architecturaux

Dernière mise à jour : 19/03/2026
Validés par : Dereck Rauzduel

---

## STYLE 1 : Maquette blanche (PRÉFÉRÉ — offre Premium)

### Template complet

```
Generate a white architectural model render (maquette blanche) of a small tropical {type_batiment} ({surface_habitable} square meters) sitting on a topographic terrain in {commune}, Guadeloupe. Style: pure white physical model, like a foam board / cardboard architecture school model, photographed on a light gray background. The terrain is sculpted in layers showing elevation contours in light gray. The building is a clean white volume with a {toiture_description}, a covered terrace with thin white columns. Surrounding: miniature white abstract trees (lollipop style). The plot boundary is marked with thin wire or thread. Axonometric view from above at 45 degrees. Soft studio lighting with gentle shadows. Clean, elegant, minimal. No text, no annotations. The aesthetic should be like a high-end architecture firm's physical model photography.
```

### Paramètres variables

| Variable | Description | Exemples |
|----------|-------------|----------|
| `{type_batiment}` | Type en anglais | "bungalow T2", "villa T4", "eco-lodge with 6 bungalows" |
| `{surface_habitable}` | Surface en m² | "40", "150", "6x30" |
| `{commune}` | Nom commune | "Goyave", "Sainte-Anne", "Le Gosier" |
| `{toiture_description}` | Type de toit | "pitched roof", "four-slope hip roof", "matching two-slope roofs" |

### Variante multi-bungalows

```
Generate a white architectural model render (maquette blanche) of a small eco-resort with {nb_bungalows} tropical bungalows ({surface}sqm each) dispersed on a topographic terrain in {commune}, Guadeloupe. Style: pure white physical model, foam board / cardboard, photographed on a light gray background. The terrain is sculpted in stacked layers showing elevation with a {element_eau} at the edge. The bungalows are clean white volumes with pitched roofs, covered terraces, raised on thin stilts. A central pergola structure connects them. Miniature white abstract trees (lollipop and palm style). Plot boundary in thin wire. Axonometric view from above at 45 degrees. Soft studio lighting. Clean, elegant, minimal. No text.
```

---

## STYLE 2 : Esquisse graphite monochrome

### Template complet

```
Generate an architectural sketch render of a small tropical {type_batiment} ({surface_habitable} square meters) on a {type_terrain} plot in {commune}, Guadeloupe, Caribbean. Style: pencil sketch on white paper, monochrome graphite, no colors. The {type_batiment} has a {forme_description} with a {toiture_description}, a covered wooden terrace with pergola facing {orientation}, and tropical vegetation ({vegetation_description}). The terrain shows {terrain_description}. Include construction setback lines (dashed). Bird's eye perspective view at 45 degrees. Professional architectural presentation quality, clean minimalist lines, white background. The render should look like a hand-drawn architect's concept sketch.
```

### Paramètres variables

| Variable | Description | Exemples |
|----------|-------------|----------|
| `{type_terrain}` | Morphologie terrain | "hillside", "flat coastal", "gently sloping riverside" |
| `{forme_description}` | Forme bâtiment | "simple rectangular shape", "L-shaped two-story layout" |
| `{orientation}` | Face terrasse | "south", "south-west", "west" |
| `{vegetation_description}` | Espèces locales | "coconut palm trees, banana trees, ferns" |
| `{terrain_description}` | Relief visible | "gentle slopes with contour lines", "flat with river at the edge" |

---

## STYLE 3 : Photoréaliste (drone simulé)

### Template complet

Ce style nécessite une description très détaillée du site réel. Analyser les photos drone avant de composer.

```
Generate a photorealistic aerial drone photograph of {projet_description} on a plot in {commune}, Guadeloupe, Caribbean. SITE: {description_site}. EXISTING: {bati_existant}. VEGETATION: {vegetation_reelle}. PROJECT: {description_projet}. PLU: {contraintes_plu}. ATMOSPHERE: {atmosphere}. Drone at {altitude}m, {angle} degrees, wide angle. Professional real estate photography. Hyperrealistic.
```

### Exemple complet validé (Goyave, 6 bungalows)

```
Generate a photorealistic aerial drone photograph of an eco-lodge project on a real plot in Goyave, Guadeloupe, Caribbean. SITE: Plot approx 2000sqm on gentle tropical hillside. Paved road runs along east side. A rocky tropical river with clear water over dark volcanic boulders runs along west side, bordered by giant ferns and mossy rocks. Terrain slopes gently from road down toward river. EXISTING: One dark wood-clad bungalow (30sqm) with dark corrugated metal roof with solar panels, on concrete blocks. Next to it a small traditional carbet with thatched palm roof. VEGETATION: 8 tall mature coconut palms scattered across green grass lawn, heliconia, banana trees along river edge. Dense rainforest hillside behind across the river. PROJECT: 6 new small dark-wood bungalows T2 (30sqm each) dispersed organically between palm trees, NOT in rows. Dark tropical wood cladding, corrugated metal roofs, covered terraces with wood railings, raised on concrete stilts with wooden stairs. Gravel paths and a shared wooden pergola dining area in the center. PLU: Height max 9m (single story 4m), setback road 5m, setback river 10m. ATMOSPHERE: Golden hour, warm tropical light through palm fronds, lush green. Drone at 40m, 45 degrees, wide angle. Hyperrealistic real estate photography.
```

### Bonnes pratiques style photoréaliste

1. Toujours analyser les photos drone avant de composer le prompt
2. Être très spécifique sur les espèces végétales observées (pas juste "tropical trees")
3. Décrire les matériaux du bâti existant exactement comme observé
4. Mentionner les éléments d'eau avec précision (rivière, direction, type de rochers)
5. Spécifier l'éclairage en cohérence avec l'orientation (golden hour = lumière ouest)
6. Rappeler les contraintes PLU pour que le projet soit crédible
7. Préciser "NOT in rows" pour les projets multi-bungalows — sinon Gemini les aligne

---

## Mapping zone géographique → paramètres

### Littoral sud
- terrain: "flat to gently sloping coastal terrain with sea visible in background"
- végétation: "coconut palm trees, sea grape shrubs, bougainvillea"
- atmosphère: "bright tropical sunlight, turquoise sea in background, white sand"

### Plaine centrale
- terrain: "flat terrain with drainage canals, mangrove visible in distance"
- végétation: "royal palm trees, mango trees, tropical shrubs"
- atmosphère: "humid tropical air, scattered cumulus clouds"

### Relief Basse-Terre
- terrain: "steep volcanic hillside with dense vegetation, mountain visible"
- végétation: "dense tropical forest, tree ferns, banana trees, breadfruit"
- atmosphère: "misty mountain air, filtered light through canopy"

### Vallées rivières (Goyave, Capesterre)
- terrain: "gentle slope toward rocky river, volcanic boulders"
- végétation: "coconut palms, banana trees, giant ferns, heliconia, mossy rocks"
- atmosphère: "golden hour, warm light filtering through palm fronds"

### Nord Grande-Terre
- terrain: "flat limestone plateau, rocky outcrops, Atlantic visible"
- végétation: "wind-bent trees, low scrubland, sugar cane fields"
- atmosphère: "bright windy day, dramatic clouds"

---

## Mapping type bâtiment → paramètres

### Bungalow 20m² (gîte)
- forme: "simple compact rectangular shape raised on short stilts with wooden stairs"
- toiture: "two-slope corrugated metal roof with wide overhangs"

### Bungalow 30-40m² (T2 tourisme)
- forme: "rectangular shape with covered terrace"
- toiture: "two-slope corrugated roof"
- ajout: "a small plunge pool nearby"

### Villa 150m² (T4 R+1)
- forme: "L-shaped two-story layout with ground floor living and upper bedrooms"
- toiture: "four-slope hip roof with red corrugated metal"
- ajout: "carport for 2 vehicles, garden wall, swimming pool"

### Mini-resort 3-6 bungalows
- forme: "small identical bungalows arranged organically, not in rows"
- toiture: "matching two-slope roofs"
- ajout: "central pool, pergola, gravel paths, tropical landscaping"

### Petit collectif R+1
- forme: "rectangular two-story with exterior corridors and balconies"
- toiture: "flat roof with solar panels"
- ajout: "ground floor parking, bike storage, communal garden"
