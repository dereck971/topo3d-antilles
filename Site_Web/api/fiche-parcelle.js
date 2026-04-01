import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';

const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

export default async function handler(req, res) {
  // Add request ID to all responses
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Apply secure CORS headers
  applySecureCORS(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/pdf');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { commune, section, numero, lat, lon, tier = 'parcelle' } = req.body;
    const isLight = tier === 'light';

    if (!commune || !section || !numero || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Missing parcel information' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Coordinates out of range' });
    }

    // Phase 1: Fetch cadastre + spatial data in parallel
    const [mnt, natura, znieff, mh, cadastre, denivele] = await Promise.allSettled([
      fetchMNTData(latitude, longitude),
      fetchNatura2000Data(latitude, longitude),
      fetchZNIEFFData(latitude, longitude),
      fetchMonumentsData(latitude, longitude),
      fetchCadastreData(latitude, longitude),
      fetchDenivele(latitude, longitude)
    ]);

    // Extract cadastre info
    const cadastreData = cadastre.status === 'fulfilled' ? cadastre.value : null;
    const surface = cadastreData?.contenance || cadastreData?.surface || null;
    const idu = cadastreData?.idu || null;
    const codeInsee = cadastreData?.code_insee || '';

    // Phase 2: Fetch risks by code INSEE (requires cadastre result)
    // + Light tier extras (PLU, extended profile, ruissellement)
    const phase2 = [fetchRisksData(codeInsee)];
    if (isLight) {
      phase2.push(fetchPLUData(latitude, longitude));
      phase2.push(fetchExtendedProfile(latitude, longitude));
    }
    const phase2Results = await Promise.allSettled(phase2);
    const risks = phase2Results[0].status === 'fulfilled' ? phase2Results[0].value : null;
    const pluData = isLight && phase2Results[1]?.status === 'fulfilled' ? phase2Results[1].value : null;
    const profileData = isLight && phase2Results[2]?.status === 'fulfilled' ? phase2Results[2].value : null;

    // Extract denivele
    const deniveleData = denivele.status === 'fulfilled' ? denivele.value : null;

    // Quality validator — check mandatory data before generating PDF
    const pdfData = {
      tier,
      commune, section, numero,
      lat: latitude, lon: longitude,
      surface, idu, codeInsee,
      denivele: deniveleData,
      plu: pluData,
      profile: profileData,
      mnt: mnt.status === 'fulfilled' ? mnt.value : null,
      risks: risks || null,
      natura: natura.status === 'fulfilled' ? natura.value : null,
      znieff: znieff.status === 'fulfilled' ? znieff.value : null,
      mh: mh.status === 'fulfilled' ? mh.value : null
    };

    const qa = validateFicheData(pdfData);
    if (!qa.valid) {
      console.error('[QA] Fiche rejected:', qa.errors);
      // Retry failed sources once
      if (qa.retryable.length > 0) {
        const retries = {};
        if (qa.retryable.includes('cadastre')) {
          const r = await fetchCadastreData(latitude, longitude).catch(() => null);
          if (r) { pdfData.surface = r.contenance || r.surface; pdfData.idu = r.idu; pdfData.codeInsee = r.code_insee || ''; retries.cadastre = true; }
        }
        if (qa.retryable.includes('mnt')) {
          const r = await fetchMNTData(latitude, longitude).catch(() => null);
          if (r !== null) { pdfData.mnt = r; retries.mnt = true; }
        }
        if (qa.retryable.includes('risks') && pdfData.codeInsee) {
          const r = await fetchRisksData(pdfData.codeInsee).catch(() => null);
          if (r) { pdfData.risks = r; retries.risks = true; }
        }
        // Re-validate after retries
        const qa2 = validateFicheData(pdfData);
        if (!qa2.valid) {
          return res.status(422).json({
            error: 'Qualite insuffisante — donnees manquantes',
            missing: qa2.errors,
            retried: Object.keys(retries)
          });
        }
      } else {
        return res.status(422).json({
          error: 'Qualite insuffisante — donnees manquantes',
          missing: qa.errors
        });
      }
    }

    // Generate PDF
    const pdfBytes = await generateFicheParcellePDF(pdfData);

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="fiche_${section}_${numero}_${Date.now()}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Length', pdfBytes.length);

    return res.status(200).send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Fiche parcelle error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Quality validator — ensures all critical data is present before PDF generation
function validateFicheData(data) {
  const errors = [];
  const retryable = [];

  // Mandatory: cadastre data (surface, IDU)
  if (!data.surface) { errors.push('Surface parcelle manquante'); retryable.push('cadastre'); }
  if (!data.idu) { errors.push('IDU cadastral manquant'); retryable.push('cadastre'); }
  if (!data.codeInsee) { errors.push('Code INSEE manquant'); retryable.push('cadastre'); }

  // Mandatory: elevation
  if (data.mnt === null || data.mnt === undefined) { errors.push('Altitude manquante'); retryable.push('mnt'); }

  // Mandatory: risks (must have fetched, even if 0 results)
  if (!data.risks) { errors.push('Donnees risques manquantes'); retryable.push('risks'); }

  // Warning-only (don't block): denivele, natura, znieff
  // These are nice-to-have but not blocking

  return { valid: errors.length === 0, errors, retryable: [...new Set(retryable)] };
}

function applySecureCORS(res, req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && origin.endsWith('.topo3d-antilles.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin === 'https://www.topo3d-antilles.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

// Sanitize text for WinAnsi encoding (pdf-lib standard fonts)
function pdfSafe(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/[^\x00-\xFF]/g, ''); // strip anything outside Latin-1
}

async function generateFicheParcellePDF(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const primaryColor = rgb(0 / 255, 200 / 255, 150 / 255); // #00c896
  const textColor = rgb(50 / 255, 50 / 255, 50 / 255);

  let page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  const titleText = data.tier === 'light' ? 'FICHE PARCELLE LIGHT' : 'FICHE PARCELLE REGLEMENTAIRE';
  page.drawText(titleText, {
    x: 50, y: yPosition, size: 22, font: boldFont, color: primaryColor
  });
  yPosition -= 35;

  // Separator
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    color: primaryColor, thickness: 2
  });
  yPosition -= 20;

  // Logo and brand
  page.drawText('Topo3D-Antilles', { x: 50, y: yPosition, size: 12, font: boldFont, color: textColor });
  yPosition -= 30;

  // Helper to draw a line of text
  const drawLine = (text, opts = {}) => {
    const { x = 70, size = 10, f = font, color = textColor } = opts;
    page.drawText(pdfSafe(text), { x, y: yPosition, size, font: f, color });
    yPosition -= (opts.spacing || 18);
  };

  // Section 1: Localisation
  const result1 = checkPageBreak(pdfDoc, page, yPosition, 200);
  page = result1.page; yPosition = result1.yPosition;
  page.drawText('1. LOCALISATION DE LA PARCELLE', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
  yPosition -= 25;

  drawLine(`Commune: ${data.commune}`);
  drawLine(`Section: ${data.section}`);
  drawLine(`Numero: ${data.numero}`);
  if (data.idu) drawLine(`IDU: ${data.idu}`);
  if (data.codeInsee) drawLine(`Code INSEE: ${data.codeInsee}`);
  if (data.surface) {
    const surfM2 = Number(data.surface);
    const surfDisplay = surfM2 >= 10000 ? `${(surfM2 / 10000).toFixed(2)} ha (${surfM2} m2)` : `${surfM2} m2`;
    drawLine(`Surface: ${surfDisplay}`);
  }
  drawLine(`Coordonnees GPS: ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}`);
  drawLine(`Date de generation: ${new Date().toLocaleDateString('fr-FR')}`);

  // Section 2: Elevation + Denivele
  const result2 = checkPageBreak(pdfDoc, page, yPosition, 250);
  page = result2.page; yPosition = result2.yPosition;
  page.drawText("2. DONNEES D'ELEVATION (IGN LiDAR)", { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
  yPosition -= 25;

  drawLine(data.mnt ? `Altitude au centre: ${data.mnt}m NGG` : 'Altitude: Donnees indisponibles');
  if (data.denivele) {
    drawLine(`Altitude min: ${data.denivele.min}m | max: ${data.denivele.max}m`);
    drawLine(`Denivele estime: ${data.denivele.delta}m (sur ${data.denivele.points} points)`);
  }
  drawLine('Source: IGN MNT (Modele Numerique de Terrain)');
  drawLine('Precision: +/- 0.2m (XY et Z) | Resolution: Maille 1m');
  drawLine('Systeme de projection: EPSG:4326 (WGS84)');

  // Section 3: Risques naturels
  const result3 = checkPageBreak(pdfDoc, page, yPosition, 220);
  page = result3.page; yPosition = result3.yPosition;
  page.drawText('3. RISQUES NATURELS', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
  yPosition -= 25;

  if (data.risks && data.risks.risques && data.risks.risques.length > 0) {
    drawLine(`${data.risks.risques.length} risque(s) identifie(s) sur ${data.risks.commune || data.commune}:`, { spacing: 16 });
    data.risks.risques.forEach(r => {
      drawLine(`- ${pdfSafe(r)}`, { spacing: 15 });
    });
  } else {
    drawLine('Aucun risque recense (donnees Georisques)', { spacing: 16 });
  }
  drawLine('Source: Georisques GASPAR (georisques.gouv.fr)', { spacing: 16 });

  // Section 4: Zones protegees
  const result4 = checkPageBreak(pdfDoc, page, yPosition, 220);
  page = result4.page; yPosition = result4.yPosition;
  page.drawText('4. ZONES PROTEGEES', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
  yPosition -= 25;

  const hasNatura = data.natura && Array.isArray(data.natura) && data.natura.length > 0;
  const hasZnieff = data.znieff && Array.isArray(data.znieff) && data.znieff.length > 0;
  const hasMh = data.mh && Array.isArray(data.mh) && data.mh.length > 0;

  drawLine(`Natura 2000: ${data.natura ? (hasNatura ? 'Oui' : 'Non') : 'Verification en cours'}`, { spacing: 16 });
  drawLine(`ZNIEFF: ${data.znieff ? (hasZnieff ? 'Oui' : 'Non') : 'Verification en cours'}`, { spacing: 16 });
  drawLine(`Monuments historiques: ${data.mh ? (hasMh ? 'Oui' : 'Non') : 'Verification en cours'}`, { spacing: 16 });
  yPosition -= 8;
  drawLine('Source: INPN (inpn.mnhn.fr) et Ministere de la Culture', { spacing: 16 });

  // --- LIGHT TIER SECTIONS (29€) ---
  if (data.tier === 'light') {
    // Section 5: Zonage PLU
    const r5 = checkPageBreak(pdfDoc, page, yPosition, 150);
    page = r5.page; yPosition = r5.yPosition;
    page.drawText('5. ZONAGE PLU', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
    yPosition -= 25;

    if (data.plu && data.plu.available) {
      drawLine(`Zone: ${data.plu.typezone} - ${data.plu.libelle}`, { spacing: 16 });
      if (data.plu.destdomi) drawLine(`Destination dominante: ${data.plu.destdomi}`, { spacing: 16 });
      drawLine('Source: Geoportail de l\'Urbanisme (GPU)', { spacing: 16 });
    } else {
      drawLine('PLU non numerise sur le Geoportail de l\'Urbanisme', { spacing: 16 });
      drawLine('Antilles: consulter le service urbanisme de la mairie', { spacing: 16 });
      if (data.codeInsee) drawLine(`Mairie de ${data.commune} (INSEE: ${data.codeInsee})`, { spacing: 16 });
      drawLine('Demander: zonage PLU, reglement de zone, COS/CES, hauteur max', { spacing: 16 });
    }

    // Section 6: Profil altimetrique
    if (data.profile) {
      const r6 = checkPageBreak(pdfDoc, page, yPosition, 200);
      page = r6.page; yPosition = r6.yPosition;
      page.drawText('6. PROFIL ALTIMETRIQUE (42 points)', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
      yPosition -= 25;

      if (data.profile.ns) {
        drawLine(`Transect Nord-Sud: ${data.profile.ns.min}m -> ${data.profile.ns.max}m (pente ${data.profile.ns.slope} deg)`, { spacing: 16 });
        // Mini ASCII profile
        const nsVals = data.profile.ns.values;
        if (nsVals && nsVals.length > 0) {
          const nMin = Math.min(...nsVals);
          const nMax = Math.max(...nsVals);
          const range = nMax - nMin || 1;
          const barChars = nsVals.map(v => {
            const h = Math.round(((v - nMin) / range) * 8);
            return ['_', '.', '-', '=', '+', '#', 'A', 'M', 'W'][h] || '#';
          });
          drawLine(`  S [${barChars.join('')}] N`, { spacing: 16 });
        }
      }
      if (data.profile.ew) {
        drawLine(`Transect Est-Ouest: ${data.profile.ew.min}m -> ${data.profile.ew.max}m (pente ${data.profile.ew.slope} deg)`, { spacing: 16 });
        const ewVals = data.profile.ew.values;
        if (ewVals && ewVals.length > 0) {
          const eMin = Math.min(...ewVals);
          const eMax = Math.max(...ewVals);
          const range = eMax - eMin || 1;
          const barChars = ewVals.map(v => {
            const h = Math.round(((v - eMin) / range) * 8);
            return ['_', '.', '-', '=', '+', '#', 'A', 'M', 'W'][h] || '#';
          });
          drawLine(`  O [${barChars.join('')}] E`, { spacing: 16 });
        }
      }
      drawLine(`Total: ${data.profile.totalPoints} points echantillonnes`, { spacing: 16 });
    }

    // Section 7: Ruissellement
    const r7 = checkPageBreak(pdfDoc, page, yPosition, 120);
    page = r7.page; yPosition = r7.yPosition;
    page.drawText('7. ANALYSE RUISSELLEMENT', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
    yPosition -= 25;

    if (data.profile?.ruissellement) {
      drawLine(`Niveau de ruissellement: ${data.profile.ruissellement}`, { spacing: 16 });
    } else {
      drawLine('Donnees insuffisantes pour l\'analyse', { spacing: 16 });
    }
    drawLine('Methode: analyse des pentes sur transects N-S et E-O', { spacing: 16 });
    drawLine('Recommandation: etude hydrogeologique si pente > 5 deg', { spacing: 16 });

    // Section 8: Infos complementaires
    const r8 = checkPageBreak(pdfDoc, page, yPosition, 180);
    page = r8.page; yPosition = r8.yPosition;
    page.drawText('8. INFORMATIONS COMPLEMENTAIRES', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
    yPosition -= 25;

    drawLine('Servitudes: consulter le certificat d\'urbanisme (CU)', { spacing: 16 });
    drawLine('Perimetre ABF: verifier monuments historiques a 500m', { spacing: 16 });
    drawLine('Raccordements: contacter EDF, eau (SIAEAG/SME), assainissement', { spacing: 16 });
    drawLine('Taxe d\'amenagement: taux variable par commune (3-5% en Guadeloupe)', { spacing: 16 });
    drawLine('', { spacing: 8 });
    drawLine('Pour aller plus loin: forfait Essentiel (59e) avec maquette 3D', { spacing: 16 });
  }

  // Footer on last page
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText(`Fiche generee par Topo3D-Antilles | ${data.tier === 'light' ? 'Forfait Light 29e' : 'Forfait Parcelle 19e'} | Donnees IGN | Licence Etalab 2.0`, {
    x: 50, y: 30, size: 8, font, color: rgb(150 / 255, 150 / 255, 150 / 255)
  });

  return await pdfDoc.save();
}

function checkPageBreak(pdfDoc, currentPage, yPosition, requiredSpace) {
  if (yPosition - requiredSpace < 50) {
    const newPage = pdfDoc.addPage([595, 842]);
    return { page: newPage, yPosition: 792 - 50 };
  }
  return { page: currentPage, yPosition };
}

// Retry wrapper for external API calls
async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // backoff
    }
  }
  return null;
}

// Fetch functions with retry logic — using URLSearchParams for safe parameter encoding
async function fetchMNTData(lat, lon) {
  const params = new URLSearchParams({ lon, lat, resource: 'ign_rge_alti_wld', zonly: 'false' });
  return fetchWithRetry(
    `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?${params}`
  ).then(data => data?.elevations?.[0]?.z ?? data?.elevation ?? 0).catch(() => null);
}

async function fetchRisksData(codeInsee) {
  // Georisques API v1 - gaspar/risques par code INSEE (latlon ne fonctionne pas pour les DOM)
  if (!codeInsee) return null;
  const params = new URLSearchParams({ code_insee: codeInsee });
  return fetchWithRetry(
    `https://www.georisques.gouv.fr/api/v1/gaspar/risques?${params}`
  ).then(data => {
    const commune = data?.data?.[0];
    if (!commune) return null;
    return {
      commune: commune.libelle_commune || '',
      risques: (commune.risques_detail || []).map(r => r.libelle_risque_long)
    };
  }).catch(() => null);
}

async function fetchNatura2000Data(lat, lon) {
  // IGN WFS for Natura 2000 sites
  const bbox = `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`;
  return fetchWithRetry(
    `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=PROTECTEDAREAS.SIC:sic&BBOX=${bbox},EPSG:4326&OUTPUTFORMAT=application/json&COUNT=5`
  ).then(data => data?.features || []).catch(() => null);
}

async function fetchZNIEFFData(lat, lon) {
  // IGN WFS for ZNIEFF
  const bbox = `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`;
  return fetchWithRetry(
    `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=PROTECTEDAREAS.ZNIEFF1:znieff1&BBOX=${bbox},EPSG:4326&OUTPUTFORMAT=application/json&COUNT=5`
  ).then(data => data?.features || []).catch(() => null);
}

async function fetchMonumentsData(lat, lon) {
  // IGN WFS for historical monuments
  const bbox = `${lon - 0.005},${lat - 0.005},${lon + 0.005},${lat + 0.005}`;
  return fetchWithRetry(
    `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=PROTECTEDSITES.MNHN.RESERVES-NATURELLES:reserves_naturelles&BBOX=${bbox},EPSG:4326&OUTPUTFORMAT=application/json&COUNT=5`
  ).then(data => data?.features || []).catch(() => null);
}

async function fetchCadastreData(lat, lon) {
  // API Cadastre — POST with GeoJSON Point
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://apicarto.ign.fr/api/cadastre/parcelle', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Topo3D-Antilles/1.0' },
      body: JSON.stringify({ geom: { type: 'Point', coordinates: [lon, lat] } })
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    const props = data.features?.[0]?.properties;
    return props || null;
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchDenivele(lat, lon) {
  // Sample 5 points in a small grid around the parcel center to compute min/max elevation
  const offset = 0.0005; // ~55m
  const points = [
    [lon, lat],
    [lon - offset, lat - offset],
    [lon + offset, lat - offset],
    [lon - offset, lat + offset],
    [lon + offset, lat + offset]
  ];
  const lonStr = points.map(p => p[0]).join('|');
  const latStr = points.map(p => p[1]).join('|');
  const params = new URLSearchParams({ lon: lonStr, lat: latStr, resource: 'ign_rge_alti_wld', zonly: 'true' });
  try {
    const data = await fetchWithRetry(
      `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?${params}`
    );
    if (!data?.elevations) return null;
    const zValues = data.elevations.map(e => e.z ?? e).filter(z => typeof z === 'number' && !isNaN(z));
    if (zValues.length === 0) return null;
    const min = Math.min(...zValues);
    const max = Math.max(...zValues);
    return { min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100, delta: Math.round((max - min) * 100) / 100, points: zValues.length };
  } catch (e) {
    return null;
  }
}

// --- LIGHT TIER FUNCTIONS ---

async function fetchPLUData(lat, lon) {
  // GPU (Geoportail de l'Urbanisme) API — zone-urba
  // Note: does not cover all DOM-TOM yet
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://apicarto.ign.fr/api/gpu/zone-urba', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geom: { type: 'Point', coordinates: [lon, lat] } })
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      return { available: false, message: 'PLU non numerise sur le GPU — consulter la mairie' };
    }
    const zone = data.features[0].properties;
    return {
      available: true,
      libelle: zone.libelle || zone.libelong || '',
      typezone: zone.typezone || '',
      destdomi: zone.destdomi || '',
      partition: zone.partition || '',
      nomfic: zone.nomfic || ''
    };
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchExtendedProfile(lat, lon) {
  // 21 points along N-S and E-W transects through parcel center
  const span = 0.002; // ~220m each direction
  const steps = 10;
  const nsPoints = [];
  const ewPoints = [];
  for (let i = -steps; i <= steps; i++) {
    const frac = i / steps;
    nsPoints.push([lon, lat + frac * span]);
    ewPoints.push([lon + frac * span, lat]);
  }
  const allPoints = [...nsPoints, ...ewPoints];
  const lonStr = allPoints.map(p => p[0]).join('|');
  const latStr = allPoints.map(p => p[1]).join('|');
  const params = new URLSearchParams({ lon: lonStr, lat: latStr, resource: 'ign_rge_alti_wld', zonly: 'true' });
  try {
    const data = await fetchWithRetry(
      `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?${params}`
    );
    if (!data?.elevations) return null;
    const all = data.elevations.map(e => e.z ?? e).filter(z => typeof z === 'number' && !isNaN(z));
    const nsZ = all.slice(0, 21);
    const ewZ = all.slice(21, 42);

    const analyze = (arr) => {
      if (arr.length === 0) return null;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      // Pente moyenne (degrees) = atan(denivele / distance)
      const distM = span * 2 * 111320; // approx meters for N-S
      const slope = Math.atan((max - min) / distM) * (180 / Math.PI);
      return { values: arr.map(v => Math.round(v * 10) / 10), min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100, slope: Math.round(slope * 10) / 10 };
    };

    const nsProfile = analyze(nsZ);
    const ewProfile = analyze(ewZ);

    // Ruissellement simplifie: direction de pente dominante
    let ruissellement = 'Plat (pente < 2 deg)';
    const maxSlope = Math.max(nsProfile?.slope || 0, ewProfile?.slope || 0);
    if (maxSlope >= 15) ruissellement = 'Fort (pente > 15 deg) — risque erosion';
    else if (maxSlope >= 5) ruissellement = 'Modere (pente 5-15 deg)';
    else if (maxSlope >= 2) ruissellement = 'Faible (pente 2-5 deg)';

    return { ns: nsProfile, ew: ewProfile, ruissellement, totalPoints: all.length };
  } catch (e) {
    return null;
  }
}
