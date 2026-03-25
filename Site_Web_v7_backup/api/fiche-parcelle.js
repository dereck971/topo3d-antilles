import { PDFDocument, rgb } from 'pdf-lib';
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
    const { commune, section, numero, lat, lon } = req.body;

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

    // Fetch regulatory data from APIs in parallel with retry logic
    const [mnt, risks, natura, znieff, mh] = await Promise.allSettled([
      fetchMNTData(latitude, longitude),
      fetchRisksData(latitude, longitude),
      fetchNatura2000Data(latitude, longitude),
      fetchZNIEFFData(latitude, longitude),
      fetchMonumentsData(latitude, longitude)
    ]);

    // Generate PDF
    const pdfBytes = await generateFicheParcellePDF({
      commune,
      section,
      numero,
      lat: latitude,
      lon: longitude,
      mnt: mnt.status === 'fulfilled' ? mnt.value : null,
      risks: risks.status === 'fulfilled' ? risks.value : null,
      natura: natura.status === 'fulfilled' ? natura.value : null,
      znieff: znieff.status === 'fulfilled' ? znieff.value : null,
      mh: mh.status === 'fulfilled' ? mh.value : null
    });

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

function applySecureCORS(res, req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && origin.endsWith('.topo3d-antilles.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin === 'https://topo3d-antilles.vercel.app') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

async function generateFicheParcellePDF(data) {
  const pdfDoc = await PDFDocument.create();
  const primaryColor = rgb(0 / 255, 200 / 255, 150 / 255); // #00c896
  const textColor = rgb(50 / 255, 50 / 255, 50 / 255);
  const lightGray = rgb(240 / 255, 240 / 255, 240 / 255);

  let page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText('FICHE PARCELLE RÉGLEMENTAIRE', {
    x: 50,
    y: yPosition,
    size: 24,
    color: primaryColor,
    maxWidth: width - 100
  });
  yPosition -= 40;

  // Separator
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    color: primaryColor,
    thickness: 2
  });
  yPosition -= 20;

  // Logo and brand
  page.drawText('Topo3D-Antilles 🏔️', {
    x: 50,
    y: yPosition,
    size: 12,
    color: textColor
  });
  yPosition -= 30;

  // Section 1: Localisation
  const result1 = checkPageBreak(pdfDoc, page, yPosition, 200);
  page = result1.page;
  yPosition = result1.yPosition;
  page.drawText('1. LOCALISATION DE LA PARCELLE', {
    x: 50,
    y: yPosition,
    size: 14,
    color: primaryColor
  });
  yPosition -= 25;

  const locationText = [
    `Commune: ${data.commune}`,
    `Section: ${data.section}`,
    `Numéro: ${data.numero}`,
    `Coordonnées GPS: ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}`,
    `Date de génération: ${new Date().toLocaleDateString('fr-FR')}`
  ];

  locationText.forEach(text => {
    page.drawText(text, {
      x: 70,
      y: yPosition,
      size: 10,
      color: textColor
    });
    yPosition -= 18;
  });

  // Section 2: Données d'élévation
  const result2 = checkPageBreak(pdfDoc, page, yPosition, 200);
  page = result2.page;
  yPosition = result2.yPosition;
  page.drawText('2. DONNÉES D\'ÉLÉVATION (IGN LiDAR)', {
    x: 50,
    y: yPosition,
    size: 14,
    color: primaryColor
  });
  yPosition -= 25;

  const elevationText = [
    `Source: IGN MNT (Modèle Numérique de Terrain)`,
    `Précision: ±0.2m (XY et Z)`,
    `Résolution: Maille 2m`,
    `Système de projection: EPSG:4326 (WGS84)`,
    data.mnt ? `Altitude estimée: ${data.mnt}m` : 'Altitude: Données en cours de chargement'
  ];

  elevationText.forEach(text => {
    page.drawText(text, {
      x: 70,
      y: yPosition,
      size: 10,
      color: textColor
    });
    yPosition -= 18;
  });

  // Section 3: Risques naturels
  const result3 = checkPageBreak(pdfDoc, page, yPosition, 250);
  page = result3.page;
  yPosition = result3.yPosition;
  page.drawText('3. RISQUES NATURELS', {
    x: 50,
    y: yPosition,
    size: 14,
    color: primaryColor
  });
  yPosition -= 25;

  const risksText = [
    data.risks ? `Zones à risques identifiées: ${data.risks.length || 'Aucun'}` : 'Données en cours de chargement',
    'Source: Géorisques (georisques.gouv.fr)',
    '• Inondation',
    '• Glissement de terrain',
    '• Séisme',
    '• Tsunami (zones côtières)'
  ];

  risksText.forEach(text => {
    page.drawText(text, {
      x: 70,
      y: yPosition,
      size: 10,
      color: textColor
    });
    yPosition -= 16;
  });

  // Section 4: Zones protégées
  const result4 = checkPageBreak(pdfDoc, page, yPosition, 250);
  page = result4.page;
  yPosition = result4.yPosition;
  page.drawText('4. ZONES PROTÉGÉES', {
    x: 50,
    y: yPosition,
    size: 14,
    color: primaryColor
  });
  yPosition -= 25;

  const protectedText = [
    data.natura ? `Natura 2000: ${data.natura ? 'Oui' : 'Non'}` : 'Natura 2000: Vérification en cours',
    data.znieff ? `ZNIEFF: ${data.znieff ? 'Oui' : 'Non'}` : 'ZNIEFF: Vérification en cours',
    data.mh ? `Monuments historiques: ${data.mh ? 'Oui' : 'Non'}` : 'Monuments: Vérification en cours',
    '',
    'Source: INPN (inpn.mnhn.fr) et Ministère de la Culture'
  ];

  protectedText.forEach(text => {
    page.drawText(text, {
      x: 70,
      y: yPosition,
      size: 10,
      color: textColor
    });
    yPosition -= 16;
  });

  // Footer
  yPosition = 30;
  page.drawText('Fiche générée par Topo3D-Antilles | Données IGN | Licence Etalab 2.0', {
    x: 50,
    y: yPosition,
    size: 8,
    color: rgb(150 / 255, 150 / 255, 150 / 255)
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
  const params = new URLSearchParams({ lat, lon });
  return fetchWithRetry(
    `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?${params}`
  ).then(data => data?.elevation || 0).catch(() => null);
}

async function fetchRisksData(lat, lon) {
  const params = new URLSearchParams({ lat, lon });
  return fetchWithRetry(
    `https://georisques.gouv.fr/api/v1/risques?${params}`
  ).then(data => data?.features || []).catch(() => null);
}

async function fetchNatura2000Data(lat, lon) {
  const params = new URLSearchParams({ lat, lon });
  return fetchWithRetry(
    `https://inpn.mnhn.fr/api/natura2000?${params}`
  ).catch(() => null);
}

async function fetchZNIEFFData(lat, lon) {
  const params = new URLSearchParams({ lat, lon });
  return fetchWithRetry(
    `https://inpn.mnhn.fr/api/znieff?${params}`
  ).catch(() => null);
}

async function fetchMonumentsData(lat, lon) {
  const params = new URLSearchParams({ lat, lon });
  return fetchWithRetry(
    `https://data.culture.gouv.fr/api/monuments?${params}`
  ).catch(() => null);
}
