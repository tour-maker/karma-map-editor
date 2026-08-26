export function getGoogleMapsApiKey(value = import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  const rawValue = `${value ?? ''}`.trim()

  if (!rawValue) {
    return ''
  }

  const match = rawValue.match(/(?:^|[?&])key=([^&]+)/)
  return match ? match[1] : rawValue
}

export function getPolygonCoordinates(polygonInstance) {
  if (!polygonInstance?.getPath) {
    return []
  }

  const path = polygonInstance.getPath()
  if (!path?.getArray) {
    return []
  }

  return path.getArray().map((point) => ({
    lat: typeof point?.lat === 'function' ? point.lat() : point?.lat,
    lng: typeof point?.lng === 'function' ? point.lng() : point?.lng
  }))
}

function calculateAreaCentroid(points) {
  let area = 0
  let centroidLat = 0
  let centroidLng = 0

  for (let index = 0; index < points.length; index += 1) {
    const currentPoint = points[index]
    const nextPoint = points[(index + 1) % points.length]
    const crossProduct = currentPoint.lng * nextPoint.lat - nextPoint.lng * currentPoint.lat

    area += crossProduct
    centroidLat += (currentPoint.lat + nextPoint.lat) * crossProduct
    centroidLng += (currentPoint.lng + nextPoint.lng) * crossProduct
  }

  if (Math.abs(area) < 1e-9) {
    return null
  }

  const scale = 1 / (3 * area)

  return {
    lat: centroidLat * scale,
    lng: centroidLng * scale
  }
}

function calculateVertexAverage(points) {
  const totals = points.reduce(
    (accumulator, point) => ({
      lat: accumulator.lat + point.lat,
      lng: accumulator.lng + point.lng
    }),
    { lat: 0, lng: 0 }
  )

  return {
    lat: totals.lat / points.length,
    lng: totals.lng / points.length
  }
}

function calculateBoundingBoxCenter(points) {
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)

  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
  }
}

function distanceToSegment(point, a, b) {
  const dx = b.lng - a.lng
  const dy = b.lat - a.lat
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return Math.hypot(point.lng - a.lng, point.lat - a.lat)
  }

  const t = Math.max(0, Math.min(1, ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / lengthSquared))

  return Math.hypot(point.lng - (a.lng + t * dx), point.lat - (a.lat + t * dy))
}

function distanceToPolygonBoundary(point, points) {
  let minDistance = Infinity

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    minDistance = Math.min(minDistance, distanceToSegment(point, points[j], points[i]))
  }

  return minDistance
}

// Grid search for the point that sits farthest from every edge (a simplified
// "pole of inaccessibility"). Unlike the centroid/average/bbox candidates,
// this is what actually finds a point deep inside a concave shape (e.g. a
// dart/notch outline) rather than one that happens to fall in a concave gap.
function findDeepestInteriorPoint(points, gridSteps = 28) {
  const originLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length
  const lngScale = Math.cos((originLat * Math.PI) / 180) || 1
  const projected = points.map((point) => ({ lat: point.lat, lng: point.lng * lngScale }))

  const lats = projected.map((point) => point.lat)
  const lngs = projected.map((point) => point.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const search = (centerLat, centerLng, halfLat, halfLng) => {
    let best = null
    let bestDistance = -Infinity

    for (let i = 0; i <= gridSteps; i += 1) {
      const lat = centerLat - halfLat + (2 * halfLat * i) / gridSteps
      for (let j = 0; j <= gridSteps; j += 1) {
        const lng = centerLng - halfLng + (2 * halfLng * j) / gridSteps
        const candidate = { lat, lng }

        if (!isPointInPolygon(candidate, projected)) {
          continue
        }

        const distance = distanceToPolygonBoundary(candidate, projected)
        if (distance > bestDistance) {
          bestDistance = distance
          best = candidate
        }
      }
    }

    return best
  }

  const coarse = search((minLat + maxLat) / 2, (minLng + maxLng) / 2, (maxLat - minLat) / 2, (maxLng - minLng) / 2)
  if (!coarse) {
    return null
  }

  const refined =
    search(coarse.lat, coarse.lng, (maxLat - minLat) / gridSteps, (maxLng - minLng) / gridSteps) ?? coarse

  return { lat: refined.lat, lng: refined.lng / lngScale }
}

function isPointInPolygon(point, points) {
  let inside = false

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const current = points[i]
    const previous = points[j]

    const crosses =
      current.lat > point.lat !== previous.lat > point.lat &&
      point.lng <
        ((previous.lng - current.lng) * (point.lat - current.lat)) / (previous.lat - current.lat) +
          current.lng

    if (crosses) {
      inside = !inside
    }
  }

  return inside
}

export function calculatePolygonCenter(coordinates = []) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null
  }

  const points = coordinates.map((point) => ({
    lat: Number(typeof point?.lat === 'function' ? point.lat() : point?.lat),
    lng: Number(typeof point?.lng === 'function' ? point.lng() : point?.lng)
  }))

  if (points.length < 3) {
    return points[0] ?? null
  }

  // The shoelace-based area centroid and the plain vertex average are both
  // cheap, but neither is guaranteed to land inside a concave (dart/notch)
  // outline, and the area centroid can additionally fall apart on a
  // self-intersecting shape. Try them first since they're free, but once a
  // candidate fails the inside check, never fall back to it again - instead
  // fall through to a grid search for the point that's actually deepest
  // inside the polygon, with the bounding-box center as the last resort.
  const areaCentroid = calculateAreaCentroid(points)
  if (areaCentroid && isPointInPolygon(areaCentroid, points)) {
    return areaCentroid
  }

  const vertexAverage = calculateVertexAverage(points)
  if (isPointInPolygon(vertexAverage, points)) {
    return vertexAverage
  }

  const interiorPoint = findDeepestInteriorPoint(points)
  if (interiorPoint) {
    return interiorPoint
  }

  return calculateBoundingBoxCenter(points)
}

export function createPolygonMarker(map, position, title = '') {
  if (!map || !position || typeof window === 'undefined') {
    return null
  }

  return new window.google.maps.Marker({
    map,
    position,
    title
  })
}

export const GOOGLE_MAPS_LIBRARIES = ['places', 'drawing', 'geometry']

export const IMPORTED_POLYGON_OPTIONS = {
  fillColor: '#16a34a',
  fillOpacity: 0.2,
  strokeColor: '#16a34a',
  strokeWeight: 2,
  clickable: true,
  editable: false,
  draggable: false,
  zIndex: 1
}

export const IMPORTED_POLYGON_HIGHLIGHT_OPTIONS = {
  fillColor: '#f59e0b',
  fillOpacity: 0.35,
  strokeColor: '#f59e0b',
  strokeWeight: 3,
  clickable: true,
  editable: false,
  draggable: false,
  zIndex: 2
}

export function createImportedMarker(map, position, options = {}) {
  if (!map || !position || typeof window === 'undefined') {
    return null
  }

  return new window.google.maps.Marker({
    map,
    position,
    draggable: false,
    ...options
  })
}

export function createImportedPolygon(map, coordinates, options = {}) {
  if (!map || !Array.isArray(coordinates) || coordinates.length < 3 || typeof window === 'undefined') {
    return null
  }

  return new window.google.maps.Polygon({
    map,
    paths: coordinates,
    ...IMPORTED_POLYGON_OPTIONS,
    ...options
  })
}

export function highlightPolygon(polygonInstance, isHighlighted, baseColor = '#38bdf8') {
  if (!polygonInstance?.setOptions) {
    return
  }

  if (isHighlighted) {
    polygonInstance.setOptions({
      fillColor: baseColor,
      fillOpacity: 0.75,
      strokeColor: '#ffffff',
      strokeWeight: 3.5,
      zIndex: 10
    })
  } else {
    polygonInstance.setOptions({
      fillColor: baseColor,
      fillOpacity: 0.55,
      strokeColor: baseColor,
      strokeWeight: 2,
      zIndex: 1
    })
  }
}

export function fitAllBounds(map, properties = []) {
  if (!map || typeof window === 'undefined' || !window.google?.maps) {
    return
  }

  const bounds = new window.google.maps.LatLngBounds()
  let hasPoints = false

  properties.forEach((property) => {
    const coordinates = Array.isArray(property?.coordinates) ? property.coordinates : []
    coordinates.forEach((point) => {
      if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) {
        bounds.extend(point)
        hasPoints = true
      }
    })

    const markerPosition = property?.markerPosition
    if (Number.isFinite(markerPosition?.lat) && Number.isFinite(markerPosition?.lng)) {
      bounds.extend(markerPosition)
      hasPoints = true
    }
  })

  if (!hasPoints) {
    return
  }

  map.fitBounds(bounds)
}

export function zoomToProperty(map, property) {
  if (!map || typeof window === 'undefined' || !window.google?.maps) {
    return
  }

  const coordinates = Array.isArray(property?.coordinates) ? property.coordinates : []
  let targetCenter = null;
  let targetZoom = 18;

  if (coordinates.length >= 3) {
    targetCenter = calculatePolygonCenter(coordinates);
    
    // Estimate appropriate zoom level based on polygon size
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach((point) => bounds.extend(point));
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    if (window.google.maps.geometry?.spherical) {
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(ne, sw);
      if (distance > 5000) targetZoom = 13;
      else if (distance > 2000) targetZoom = 14;
      else if (distance > 1000) targetZoom = 15;
      else if (distance > 500) targetZoom = 16;
      else if (distance > 200) targetZoom = 17;
      else targetZoom = 18;
    }
  } else if (property?.markerPosition) {
    targetCenter = property.markerPosition;
  }

  if (targetCenter) {
    // Apply a vertical offset for Mobile Portrait so the polygon isn't hidden by the bottom info panel
    const isMobilePortrait = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
    if (isMobilePortrait && map.getProjection()) {
      const projection = map.getProjection();
      const targetPoint = projection.fromLatLngToPoint(targetCenter);
      if (targetPoint) {
        // Move the center point South (positive Y) so the polygon appears higher on the screen
        const offsetPixels = window.innerHeight * 0.25; // Offset by 25% of screen height
        const scale = Math.pow(2, targetZoom);
        targetPoint.y += offsetPixels / scale;
        
        // Convert back to LatLng
        const offsetLatLng = projection.fromPointToLatLng(targetPoint);
        if (offsetLatLng) {
          targetCenter = offsetLatLng;
        }
      }
    }

    // Smoothly pan to the center
    map.panTo(targetCenter);
    
    // Smoothly animate the zoom level
    const currentZoom = map.getZoom();
    if (currentZoom !== targetZoom) {
      const step = currentZoom < targetZoom ? 1 : -1;
      let z = currentZoom;
      const timer = setInterval(() => {
        z += step;
        map.setZoom(z);
        if (z === targetZoom) clearInterval(timer);
      }, 80); // 80ms delay per zoom step for a smooth fly-in effect
    }
  }
}

/**
 * Fit the map around all KML polygons and markers.
 * kmlPolygons: array of { coordinates: [{lat,lng}] }
 * kmlMarkers:  array of { position: {lat,lng} }
 */
export function fitKmlBounds(map, kmlPolygons = [], kmlMarkers = []) {
  if (!map || typeof window === 'undefined' || !window.google?.maps) {
    return
  }

  const bounds = new window.google.maps.LatLngBounds()
  let hasPoints = false

  kmlPolygons.forEach((feature) => {
    const coords = Array.isArray(feature?.coordinates) ? feature.coordinates : []
    coords.forEach((point) => {
      if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) {
        bounds.extend(point)
        hasPoints = true
      }
    })
  })

  kmlMarkers.forEach((feature) => {
    const pos = feature?.position
    if (Number.isFinite(pos?.lat) && Number.isFinite(pos?.lng)) {
      bounds.extend(pos)
      hasPoints = true
    }
  })

  if (!hasPoints) return
  map.fitBounds(bounds)
}

/**
 * Zoom to a single KML feature (polygon or point marker).
 */
export function zoomToKmlFeature(map, feature) {
  if (!map || !feature || typeof window === 'undefined' || !window.google?.maps) {
    return
  }

  if (feature.type === 'polygon' && Array.isArray(feature.coordinates) && feature.coordinates.length >= 3) {
    const bounds = new window.google.maps.LatLngBounds()
    feature.coordinates.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds)
    return
  }

  if (feature.type === 'point' && feature.position) {
    map.panTo(feature.position)
    map.setZoom(17)
  }
}

export function createPinSvgUrl(color) {
  const svg = `<svg width="20" height="28" viewBox="0 0 16 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" fill="${color}" />
    <circle cx="8" cy="8" r="2" fill="white" />
    <path d="M8 14L8 23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

export function getCategoryPinIcon(color) {
  if (typeof window === 'undefined' || !window.google?.maps) return null;
  return {
    url: createPinSvgUrl(color),
    scaledSize: new window.google.maps.Size(20, 28),
    anchor: new window.google.maps.Point(10, 27)
  };
}

