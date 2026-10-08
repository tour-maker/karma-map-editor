// Which plots decide where the map first opens. A few plots can sit hundreds of kilometres away
// from the rest (another state); fitting the view to ALL plots then zooms out over empty land.
// Plots far from the main cluster still exist on the map - they just do not choose the first view.
const EARTH_KM = 6371;

function positionOf(feature) {
  const points = Array.isArray(feature?.coordinates) ? feature.coordinates.filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)) : [];
  if (points.length) {
    return {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length
    };
  }
  const m = feature?.markerPosition;
  return Number.isFinite(m?.lat) && Number.isFinite(m?.lng) ? { lat: m.lat, lng: m.lng } : null;
}

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

const median = (values) => {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function featuresForInitialView(features = [], maxKm = 150) {
  const located = features.map(feature => ({ feature, position: positionOf(feature) })).filter(item => item.position);
  if (located.length < 3) return features;
  const center = { lat: median(located.map(i => i.position.lat)), lng: median(located.map(i => i.position.lng)) };
  const near = located.filter(item => distanceKm(center, item.position) <= maxKm).map(item => item.feature);
  return near.length ? near : features;
}
