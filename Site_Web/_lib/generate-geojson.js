/**
 * generate-geojson.js — Generate GeoJSON export with parcel + contours
 */

/**
 * Generate GeoJSON FeatureCollection with parcel boundary and optional contours
 * @param {Object} parcelFeature - GeoJSON Feature from cadastre API
 * @param {Array} contours - Optional metric contours to include
 * @param {Object} gridData - Grid data for coordinate conversion
 * @returns {string} GeoJSON string
 */
export function generateGeoJSON(parcelFeature, contours = null, gridData = null) {
  const features = [];

  // Add parcel boundary
  if (parcelFeature) {
    features.push({
      type: 'Feature',
      properties: {
        type: 'parcelle',
        ...(parcelFeature.properties || {})
      },
      geometry: parcelFeature.geometry
    });
  }

  // Add contour lines if provided
  if (contours && gridData) {
    const { bbox, mPerDegLat, mPerDegLng } = gridData;
    const originLng = bbox.minLng;
    const originLat = bbox.minLat;

    for (const c of contours) {
      for (const chain of c.chains) {
        if (chain.length < 2) continue;

        // Convert metric back to WGS84
        const coordinates = chain.map(pt => [
          originLng + pt.x / mPerDegLng,
          originLat + pt.y / mPerDegLat
        ]);

        features.push({
          type: 'Feature',
          properties: {
            type: 'contour',
            elevation: c.level,
            isMajor: c.isMajor
          },
          geometry: {
            type: 'LineString',
            coordinates
          }
        });
      }
    }
  }

  const collection = {
    type: 'FeatureCollection',
    name: 'Topo3D Antilles Export',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
    },
    features
  };

  return JSON.stringify(collection, null, 2);
}
