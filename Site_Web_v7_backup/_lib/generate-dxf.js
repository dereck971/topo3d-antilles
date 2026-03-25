/**
 * generate-dxf.js — Generate DXF R12 file with contour lines
 * DXF format: AC1009 (AutoCAD R12) for maximum compatibility
 */

/**
 * Generate DXF file content from contour data
 * @param {Array} contours - Metric contours from contoursToMetric()
 * @param {Array} parcelLocal - Parcel boundary as [[x,y], ...] local coords
 * @param {Object} meta - {section, numero, commune, zMin, zMax, resolution}
 * @returns {string} DXF file content
 */
export function generateDXF(contours, parcelLocal = null, meta = {}) {
  const lines = [];

  // === HEADER SECTION ===
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009');
  lines.push('9', '$INSUNITS', '70', '6'); // meters
  lines.push('0', 'ENDSEC');

  // === TABLES SECTION (layers) ===
  lines.push('0', 'SECTION', '2', 'TABLES');

  // Layer table
  lines.push('0', 'TABLE', '2', 'LAYER', '70', '5');

  // Layer: CONTOURS_MINEURES (gray, thin)
  lines.push('0', 'LAYER', '2', 'CONTOURS_MINEURES', '70', '0', '62', '8', '6', 'CONTINUOUS');

  // Layer: CONTOURS_MAJEURES (white, thick)
  lines.push('0', 'LAYER', '2', 'CONTOURS_MAJEURES', '70', '0', '62', '7', '6', 'CONTINUOUS');

  // Layer: PARCELLE (red)
  lines.push('0', 'LAYER', '2', 'PARCELLE', '70', '0', '62', '1', '6', 'CONTINUOUS');

  // Layer: POINTS_COTES (green)
  lines.push('0', 'LAYER', '2', 'POINTS_COTES', '70', '0', '62', '3', '6', 'CONTINUOUS');

  // Layer: ANNOTATIONS (cyan)
  lines.push('0', 'LAYER', '2', 'ANNOTATIONS', '70', '0', '62', '4', '6', 'CONTINUOUS');

  lines.push('0', 'ENDTAB');
  lines.push('0', 'ENDSEC');

  // === ENTITIES SECTION ===
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  // --- Contour lines ---
  for (const contour of contours) {
    const layerName = contour.isMajor ? 'CONTOURS_MAJEURES' : 'CONTOURS_MINEURES';

    for (const chain of contour.chains) {
      if (chain.length < 2) continue;

      // Use POLYLINE entity (DXF R12)
      lines.push('0', 'POLYLINE');
      lines.push('8', layerName);
      lines.push('66', '1'); // vertices follow
      lines.push('70', '8'); // 3D polyline

      for (const pt of chain) {
        lines.push('0', 'VERTEX');
        lines.push('8', layerName);
        lines.push('10', pt.x.toFixed(3));
        lines.push('20', pt.y.toFixed(3));
        lines.push('30', (pt.z || 0).toFixed(3));
      }

      lines.push('0', 'SEQEND');
      lines.push('8', layerName);
    }
  }

  // --- Parcel boundary ---
  if (parcelLocal && parcelLocal.length >= 3) {
    lines.push('0', 'POLYLINE');
    lines.push('8', 'PARCELLE');
    lines.push('66', '1');
    lines.push('70', '9'); // 3D closed polygon

    for (const pt of parcelLocal) {
      lines.push('0', 'VERTEX');
      lines.push('8', 'PARCELLE');
      lines.push('10', pt[0].toFixed(3));
      lines.push('20', pt[1].toFixed(3));
      lines.push('30', '0.000');
    }

    // Close polygon
    lines.push('0', 'VERTEX');
    lines.push('8', 'PARCELLE');
    lines.push('10', parcelLocal[0][0].toFixed(3));
    lines.push('20', parcelLocal[0][1].toFixed(3));
    lines.push('30', '0.000');

    lines.push('0', 'SEQEND');
    lines.push('8', 'PARCELLE');
  }

  // --- Annotation text ---
  if (meta.section && meta.numero) {
    lines.push('0', 'TEXT');
    lines.push('8', 'ANNOTATIONS');
    lines.push('10', '0.000');
    lines.push('20', '-5.000');
    lines.push('30', '0.000');
    lines.push('40', '2.0'); // text height
    lines.push('1', `Parcelle ${meta.section} ${meta.numero} - ${meta.commune || ''}`);
  }

  lines.push('0', 'ENDSEC');

  // === EOF ===
  lines.push('0', 'EOF');

  return lines.join('\n');
}

/**
 * Convert GeoJSON polygon coordinates to local metric coordinates
 * @param {Array} coords - GeoJSON ring [[lng,lat], ...]
 * @param {number} originLng - Origin longitude
 * @param {number} originLat - Origin latitude
 * @param {number} mPerDegLng - Meters per degree longitude
 * @param {number} mPerDegLat - Meters per degree latitude
 * @returns {Array} [[x,y], ...]
 */
export function geoToLocal(coords, originLng, originLat, mPerDegLng, mPerDegLat) {
  return coords.map(([lng, lat]) => [
    (lng - originLng) * mPerDegLng,
    (lat - originLat) * mPerDegLat
  ]);
}
