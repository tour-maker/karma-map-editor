// Zoom level used when jumping to a single submitted plot (street level, whole plot in view).
export const SUBMISSION_FOCUS_ZOOM = 17;

// Centre of a polygon's bounding box, as a { lat, lng } literal the Google map accepts.
// Points that are missing or not finite numbers are ignored. Returns null when no usable
// point exists, so callers can simply do nothing.
export function getCoordinatesCenter(coordinates) {
  if (!Array.isArray(coordinates)) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  coordinates.forEach(point => {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (point == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  });
  if (!Number.isFinite(minLat)) return null;
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}
