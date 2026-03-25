MAQUETTE BLANCHE - Villa T4 R+1 Pointe-Noire
=============================================

File: preview-maquette-pointe-noire.html
Location: /sessions/kind-elegant-wozniak/mnt/SYNTHESE ECOSYSTEME/

SPECIFICATIONS IMPLEMENTED
===========================

✓ Three.js r128 from CDN (https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js)
✓ Terrain data fully embedded inline (48KB of vertex/index data)
✓ Light gray background (#f0f0f0)
✓ White matte terrain mesh (MeshStandardMaterial, color #f5f3f0, roughness 0.88, DoubleSide)
✓ PCFSoft shadows enabled (shadowMap.type = THREE.PCFSoftShadowMap)
✓ ACES filmic tone mapping (renderer.toneMapping = THREE.ACESFilmicToneMapping)

LAYER SYSTEM
============

Interactive iOS-style toggle switches for:
1. Terrain - White mesh with base/socle platform
2. Courbes de niveau - Contour lines extracted from TERRAIN_DATA.contours
3. Limite parcelle - Green (#00c896) boundary following terrain altitude
4. Villa projet - L-shaped two-story villa with:
   - Raw concrete + white aesthetic walls
   - Dark wood frame accents
   - 4-slope hip roof with solar panels
   - Large rectangular pool with wooden deck terrace
   - Traditional Creole carbet (gazebo) structure
   - Stone path entrance
5. Végétation - Tropical landscape:
   - Coconut palms with curved trunks and fronds
   - Breadfruit trees
   - Tropical shrubs
6. Bâti existant - (Disabled) "No existing buildings"

MANUAL ORBITAL CONTROLS
=======================

No external OrbitControls - fully custom implementation:
- Left click + drag: Orbit (spherical theta/phi)
- Scroll wheel: Zoom (radius 5-50m)
- Right click + drag: Pan
- Touch (1 finger): Orbit
- Touch (2 finger pinch): Zoom
- Context menu blocked on canvas

INFO OVERLAY
============

Title: "Maquette Blanche — Villa T4 R+1 Pointe-Noire — Parcelle AO 0088"

Property Information Display:
- Parcelle: AO 0088
- Location: Pointe-Noire, Guadeloupe
- Surface: 1771 m²
- Altitude: 3.6m — 13.7m
- Dénivelé: 10.0m
- Pente: 10.5%

TECHNICAL FEATURES
==================

- Self-contained HTML file (no external dependencies except Three.js CDN)
- getHeightAtXZ() function finds nearest vertex in terrain data for accurate placement
- Villa positioned at correct terrain height
- Vegetation automatically positioned at terrain altitudes
- Full shadow casting and receiving
- Responsive to window resize
- Real-time layer visibility toggle
- Optimized with vertex normals computation

FILE STATISTICS
===============

File size: ~79KB
Total lines: 875
Embedded terrain data: ~48KB
HTML/CSS/JS: ~31KB

USAGE
=====

Simply open preview-maquette-pointe-noire.html in a modern web browser.
No server required - file is fully self-contained.

Use toggle switches on right side to show/hide layers.
Use mouse to orbit, zoom, and pan the 3D view.

BROWSER COMPATIBILITY
====================

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Any browser with WebGL 2.0 support

Requires:
- JavaScript enabled
- WebGL support
- Display with minimum 1024x768 resolution (responsive design)
