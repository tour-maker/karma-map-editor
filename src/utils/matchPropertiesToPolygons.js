import * as turf from '@turf/turf'

export const MATCH_TIERS = {
  EXACT_ID: 'exact-tp-fp',
  CONTAINS: 'contains',
  NEAREST_BORDER: 'nearest-border',
  UNMATCHED: 'unmatched'
}

const METERS_PER_DEGREE_LAT = 111320

export function normalizeIdentifier(value) {
  if (value == null) return ''
  const stripped = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return stripped.replace(/^0+(?=\d)/, '')
}

function toClosedRing(coordinates) {
  const ring = coordinates.map((c) => [c.lng, c.lat])
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first)
  }
  return ring
}

function expandedBoundingBox(coordinates, bufferMeters) {
  const lats = coordinates.map((c) => c.lat)
  const lngs = coordinates.map((c) => c.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const midLat = (minLat + maxLat) / 2
  const latBuffer = bufferMeters / METERS_PER_DEGREE_LAT
  const lngScale = Math.cos((midLat * Math.PI) / 180) || 1
  const lngBuffer = bufferMeters / (METERS_PER_DEGREE_LAT * lngScale)

  return {
    minLat: minLat - latBuffer,
    maxLat: maxLat + latBuffer,
    minLng: minLng - lngBuffer,
    maxLng: maxLng + lngBuffer
  }
}

function isPointInBoundingBox(point, bbox) {
  return (
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat &&
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng
  )
}

export function isPointInPolygon(point, coordinates) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false
  if (!Array.isArray(coordinates) || coordinates.length < 3) return false
  try {
    const ring = toClosedRing(coordinates)
    if (ring.length < 4) return false
    const pt = turf.point([point.lng, point.lat])
    const poly = turf.polygon([ring])
    return turf.booleanPointInPolygon(pt, poly)
  } catch (err) {
    return false
  }
}

export function distanceToPolygonBoundaryMeters(point, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) return Infinity
  const pt = turf.point([point.lng, point.lat])
  const line = turf.lineString(toClosedRing(coordinates))
  return turf.pointToLineDistance(pt, line, { units: 'meters' })
}

export function matchPropertiesToPolygons(pins = [], polygons = [], options = {}) {
  const { maxDistanceMeters = 1000 } = options
  const safePins = Array.isArray(pins) ? pins : []
  const safePolygons = Array.isArray(polygons) ? polygons : []

  // For large datasets (300+ pins × 300+ polygons), skip the expensive
  // nearest-border tier to prevent the browser from hanging.
  const isLargeDataset = safePins.length * safePolygons.length > 50000

  const polygonEntries = safePolygons
    .filter((polygon) => polygon && Array.isArray(polygon.coordinates) && polygon.coordinates.length >= 3)
    .map((polygon) => {
      // Tight bbox (no buffer) for the fast contains check
      const lats = polygon.coordinates.map((c) => c.lat)
      const lngs = polygon.coordinates.map((c) => c.lng)
      const tightBbox = {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs)
      }
      // Expanded bbox only used for nearest-border fallback
      const expandedBbox = expandedBoundingBox(polygon.coordinates, maxDistanceMeters)
      return {
        polygon,
        normalizedTp: normalizeIdentifier(polygon.tp),
        normalizedFp: normalizeIdentifier(polygon.fp),
        bbox: expandedBbox,
        tightBbox
      }
    })

  const tpFpIndex = new Map()
  polygonEntries.forEach((entry) => {
    if (entry.normalizedTp && entry.normalizedFp) {
      const key = `${entry.normalizedTp}::${entry.normalizedFp}`
      if (!tpFpIndex.has(key)) {
        tpFpIndex.set(key, entry)
      }
    }
  })

  const claimedPolygonIds = new Set()
  const resultByPinId = new Map()
  const hasValidPosition = (pin) =>
    pin.position && Number.isFinite(pin.position.lat) && Number.isFinite(pin.position.lng)

  // Tier 1: Exact TP/FP match
  const remainingAfterExact = []
  safePins.forEach((pin) => {
    const pinTp = normalizeIdentifier(pin.tp)
    const pinFp = normalizeIdentifier(pin.fp)

    if (pinTp && pinFp) {
      const exact = tpFpIndex.get(`${pinTp}::${pinFp}`)
      if (exact && !claimedPolygonIds.has(exact.polygon.id)) {
        claimedPolygonIds.add(exact.polygon.id)
        resultByPinId.set(pin.id, {
          pinId: pin.id,
          polygonId: exact.polygon.id,
          tier: MATCH_TIERS.EXACT_ID,
          distanceMeters: 0
        })
        return
      }
    }
    remainingAfterExact.push(pin)
  })

  // Tier 2: Point-in-polygon (uses tight bbox — much faster)
  const remainingAfterContains = []
  remainingAfterExact.forEach((pin) => {
    if (!hasValidPosition(pin)) {
      remainingAfterContains.push(pin)
      return
    }

    // Use tight bbox first (no buffer) to quickly eliminate non-candidates
    const candidates = polygonEntries.filter(
      (entry) =>
        !claimedPolygonIds.has(entry.polygon.id) &&
        pin.position.lat >= entry.tightBbox.minLat &&
        pin.position.lat <= entry.tightBbox.maxLat &&
        pin.position.lng >= entry.tightBbox.minLng &&
        pin.position.lng <= entry.tightBbox.maxLng
    )
    const contains = candidates.find((entry) => isPointInPolygon(pin.position, entry.polygon.coordinates))

    if (contains) {
      claimedPolygonIds.add(contains.polygon.id)
      resultByPinId.set(pin.id, {
        pinId: pin.id,
        polygonId: contains.polygon.id,
        tier: MATCH_TIERS.CONTAINS,
        distanceMeters: 0
      })
    } else {
      remainingAfterContains.push(pin)
    }
  })

  // Tier 3: Nearest-border fallback (skipped for large datasets to prevent freeze)
  if (!isLargeDataset) {
    const candidatePairs = []
    remainingAfterContains.forEach((pin) => {
      if (!hasValidPosition(pin)) return

      polygonEntries.forEach((entry) => {
        if (claimedPolygonIds.has(entry.polygon.id) || !isPointInBoundingBox(pin.position, entry.bbox)) {
          return
        }
        const distance = distanceToPolygonBoundaryMeters(pin.position, entry.polygon.coordinates)
        if (distance <= maxDistanceMeters) {
          candidatePairs.push({ pin, entry, distance })
        }
      })
    })
    candidatePairs.sort((a, b) => a.distance - b.distance)

    const assignedPinIds = new Set()
    candidatePairs.forEach(({ pin, entry, distance }) => {
      if (assignedPinIds.has(pin.id) || claimedPolygonIds.has(entry.polygon.id)) {
        return
      }
      assignedPinIds.add(pin.id)
      claimedPolygonIds.add(entry.polygon.id)
      resultByPinId.set(pin.id, {
        pinId: pin.id,
        polygonId: entry.polygon.id,
        tier: MATCH_TIERS.NEAREST_BORDER,
        distanceMeters: Math.round(distance * 100) / 100
      })
    })
  }

  return safePins.map(
    (pin) =>
      resultByPinId.get(pin.id) ?? {
        pinId: pin.id,
        polygonId: null,
        tier: MATCH_TIERS.UNMATCHED,
        distanceMeters: null
      }
  )
}

export default matchPropertiesToPolygons;

