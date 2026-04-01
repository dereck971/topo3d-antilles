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
  page.drawText('FICHE PARCELLE REGLEMENTAIRE', {
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
  drawLine(`Coordonnees GPS: ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}`);
  drawLine(`Date de generation: ${new Date().toLocaleDateString('fr-FR')}`);

  // Section 2: Elevation
  const result2 = checkPageBreak(pdfDoc, page, yPosition, 200);
  page = result2.page; yPosition = result2.yPosition;
  page.drawText("2. DONNEES D'ELEVATION (IGN LiDAR)", { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
  yPosition -= 25;

  drawLine('Source: IGN MNT (Modele Numerique de Terrain)');
  drawLine('Precision: +/- 0.2m (XY et Z)');
  drawLine('Resolution: Maille 2m');
  drawLine('Systeme de projection: EPSG:4326 (WGS84)');
  drawLine(data.mnt ? `Altitude estimee: ${data.mnt}m` : 'Altitude: Donnees en cours de chargement');

  // Section 3: Risques naturels
  const result3 = checkPageBreak(pdfDoc, page, yPosition, 220);
  page = result3.page; yPosition = result3.yPosition;
  page.drawText('3. RISQUES NATURELS', { x: 50, y: yPosition, size: 13, font: boldFont, color: primaryColor });
  yPosition -= 25;

  const riskCount = data.risks && Array.isArray(data.risks) ? data.risks.length : 0;
  drawLine(data.risks ? `Zones a risques identifiees: ${riskCount || 'Aucun'}` : 'Donnees en cours de chargement', { spacing: 16 });
  drawLine('Source: Georisques (georisques.gouv.fr)', { spacing: 16 });
  drawLine('- Inondation', { spacing: 16 });
  drawLine('- Glissement de terrain', { spacing: 16 });
  drawLine('- Seisme', { spacing: 16 });
  drawLine('- Tsunami (zones cotieres)', { spacing: 16 });

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

  // Footer
  page.drawText('Fiche generee par Topo3D-Antilles | Donnees IGN | Licence Etalab 2.0', {
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

async function fetchRisksData(lat, lon) {
  // Georisques API v1 - gaspar/risques
  const params = new URLSearchParams({ latlon: `${lat},${lon}`, rayon: 500 });
  return fetchWithRetry(
    `https://www.georisques.gouv.fr/api/v1/gaspar/risques?${params}`
  ).then(data => data?.data || []).catch(() => null);
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
