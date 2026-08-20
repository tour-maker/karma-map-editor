import { validateFeature } from './validation';

export function importFeaturesFromGeoJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
          throw new Error('Invalid GeoJSON format');
        }

        const features = [];
        let warnings = [];

        json.features.forEach((feature, index) => {
          try {
            if (feature.geometry?.type === 'Point') {
              const [lng, lat] = feature.geometry.coordinates;
              const position = { lat, lng };
              const p = feature.properties || {};

              const newFeature = {
                id: p.id || `geojson-${Date.now()}-${index}`,
                source: p.source || 'geojson',
                type: 'marker',
                position,
                center: position,
                data: {
                  name: p.name || `GeoJSON Feature ${index + 1}`,
                  project: p.project || 'GeoJSON Import',
                  tp: p.tp ? String(p.tp) : undefined,
                  op: p.op ? String(p.op) : undefined,
                  fp: p.fp ? String(p.fp) : undefined,
                  area: typeof p.area === 'number' ? p.area : undefined,
                  location: p.location || '',
                  landmark: p.landmark || '',
                  type: p.type || p.propertyType || '',
                  remarks: p.remarks || p.remark || ''
                },
                style: {
                  fillColor: p.fillColor || '#10b981',
                  strokeColor: p.strokeColor || '#10b981'
                }
              };

              features.push(validateFeature(newFeature));
            } else if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
              const rawCoords = feature.geometry.type === 'Polygon' 
                ? feature.geometry.coordinates[0] 
                : feature.geometry.coordinates[0][0];

              if (!rawCoords || rawCoords.length < 3) return;

              const coordinates = rawCoords.map(c => ({ lng: c[0], lat: c[1] }));
              
              if (
                coordinates.length > 0 && 
                coordinates[0].lat === coordinates[coordinates.length - 1].lat &&
                coordinates[0].lng === coordinates[coordinates.length - 1].lng
              ) {
                coordinates.pop();
              }

              const latSum = coordinates.reduce((sum, c) => sum + c.lat, 0);
              const lngSum = coordinates.reduce((sum, c) => sum + c.lng, 0);
              const center = {
                lat: latSum / coordinates.length,
                lng: lngSum / coordinates.length
              };

              const p = feature.properties || {};

              const newFeature = {
                id: p.id || `geojson-${Date.now()}-${index}`,
                source: p.source || 'geojson',
                type: 'polygon',
                coordinates,
                center,
                data: {
                  name: p.name || `GeoJSON Feature ${index + 1}`,
                  project: p.project || 'GeoJSON Import',
                  tp: p.tp ? String(p.tp) : undefined,
                  op: p.op ? String(p.op) : undefined,
                  fp: p.fp ? String(p.fp) : undefined,
                  area: typeof p.area === 'number' ? p.area : undefined,
                  location: p.location || '',
                  landmark: p.landmark || '',
                  type: p.type || p.propertyType || '',
                  remarks: p.remarks || p.remark || ''
                },
                style: {
                  fillColor: p.fillColor || '#10b981',
                  strokeColor: p.strokeColor || '#10b981',
                  fillOpacity: 0.25,
                  strokeWeight: 2,
                }
              };

              features.push(validateFeature(newFeature));
            }
          } catch (err) {
            warnings.push(`Skipped invalid feature at index ${index}: ${err.message}`);
          }
        });

        resolve({ features, warnings });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export default importFeaturesFromGeoJSON;
