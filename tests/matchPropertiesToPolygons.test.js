import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import {
  matchPropertiesToPolygons,
  normalizeIdentifier,
  isPointInPolygon,
  distanceToPolygonBoundaryMeters,
  MATCH_TIERS
} from '../src/utils/matchPropertiesToPolygons';

// A simple ~200m x 200m square centered near (21.170, 72.831) — an arbitrary
// Surat-area coordinate, well away from the poles so degree/meter math is stable.
const CENTER = { lat: 21.170, lng: 72.831 };

function squarePolygon(center, halfSideMeters) {
  const north = turf.destination([center.lng, center.lat], halfSideMeters, 0, { units: 'meters' });
  const south = turf.destination([center.lng, center.lat], halfSideMeters, 180, { units: 'meters' });
  const east = turf.destination([center.lng, center.lat], halfSideMeters, 90, { units: 'meters' });
  const west = turf.destination([center.lng, center.lat], halfSideMeters, -90, { units: 'meters' });

  const north_lat = north.geometry.coordinates[1];
  const south_lat = south.geometry.coordinates[1];
  const east_lng = east.geometry.coordinates[0];
  const west_lng = west.geometry.coordinates[0];

  return [
    { lat: north_lat, lng: west_lng },
    { lat: north_lat, lng: east_lng },
    { lat: south_lat, lng: east_lng },
    { lat: south_lat, lng: west_lng }
  ];
}

function pointAtDistanceFrom(point, distanceMeters, bearing) {
  const dest = turf.destination([point.lng, point.lat], distanceMeters, bearing, { units: 'meters' });
  return { lat: dest.geometry.coordinates[1], lng: dest.geometry.coordinates[0] };
}

describe('normalizeIdentifier', () => {
  it('strips whitespace, punctuation, and case differences', () => {
    expect(normalizeIdentifier(' TP-82 ')).toBe('tp82');
    expect(normalizeIdentifier('tp82')).toBe('tp82');
  });

  it('strips leading zeros', () => {
    expect(normalizeIdentifier('082')).toBe('82');
    expect(normalizeIdentifier('82')).toBe('82');
  });

  it('returns empty string for nullish input', () => {
    expect(normalizeIdentifier(null)).toBe('');
    expect(normalizeIdentifier(undefined)).toBe('');
    expect(normalizeIdentifier('')).toBe('');
  });
});

describe('isPointInPolygon / distanceToPolygonBoundaryMeters', () => {
  const square = squarePolygon(CENTER, 100); // ~200m square

  it('detects a point strictly inside the polygon', () => {
    expect(isPointInPolygon(CENTER, square)).toBe(true);
  });

  it('detects a point far outside the polygon', () => {
    const far = pointAtDistanceFrom(CENTER, 5000, 45);
    expect(isPointInPolygon(far, square)).toBe(false);
  });

  it('measures boundary distance accurately for a point outside', () => {
    // A point 150m due east of center is 50m outside the eastern edge (which sits ~100m out).
    const outside = pointAtDistanceFrom(CENTER, 150, 90);
    const distance = distanceToPolygonBoundaryMeters(outside, square);
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(60);
  });
});

describe('matchPropertiesToPolygons', () => {
  const square = squarePolygon(CENTER, 100);

  it('prioritizes an exact TP+FP match even when the pin is geometrically far away', () => {
    const pins = [{ id: 'pin-1', tp: '082', fp: 'FP-5', position: pointAtDistanceFrom(CENTER, 5000, 0) }];
    const polygons = [{ id: 'poly-1', tp: '82', fp: 'fp5', coordinates: square }];

    const [result] = matchPropertiesToPolygons(pins, polygons);
    expect(result).toEqual({
      pinId: 'pin-1',
      polygonId: 'poly-1',
      tier: MATCH_TIERS.EXACT_ID,
      distanceMeters: 0
    });
  });

  it('falls back to strict containment when TP/FP are missing or do not match', () => {
    const pins = [{ id: 'pin-1', position: CENTER }];
    const polygons = [{ id: 'poly-1', coordinates: square }];

    const [result] = matchPropertiesToPolygons(pins, polygons);
    expect(result.tier).toBe(MATCH_TIERS.CONTAINS);
    expect(result.polygonId).toBe('poly-1');
  });

  it('falls back to nearest border within the max distance when the pin sits outside every polygon', () => {
    const outside = pointAtDistanceFrom(CENTER, 150, 90); // ~50m past the eastern edge
    const pins = [{ id: 'pin-1', position: outside }];
    const polygons = [{ id: 'poly-1', coordinates: square }];

    const [result] = matchPropertiesToPolygons(pins, polygons, { maxDistanceMeters: 1000 });
    expect(result.tier).toBe(MATCH_TIERS.NEAREST_BORDER);
    expect(result.polygonId).toBe('poly-1');
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.distanceMeters).toBeLessThan(1000);
  });

  it('picks the closest of several candidate polygons', () => {
    const nearSquare = squarePolygon(CENTER, 100);
    const farCenter = pointAtDistanceFrom(CENTER, 600, 0);
    const farSquare = squarePolygon(farCenter, 100);

    const outside = pointAtDistanceFrom(CENTER, 150, 90); // close to nearSquare, far from farSquare
    const pins = [{ id: 'pin-1', position: outside }];
    const polygons = [
      { id: 'poly-far', coordinates: farSquare },
      { id: 'poly-near', coordinates: nearSquare }
    ];

    const [result] = matchPropertiesToPolygons(pins, polygons, { maxDistanceMeters: 1000 });
    expect(result.polygonId).toBe('poly-near');
  });

  it('does not let two competing pins claim the same polygon in the nearest-border tier', () => {
    // Both pins are only near this one polygon; the closer pin should win it
    // and the other should end up unmatched rather than silently sharing it.
    const closePin = pointAtDistanceFrom(CENTER, 150, 90) // ~50m past the eastern edge
    const fartherPin = pointAtDistanceFrom(CENTER, 250, 90) // ~150m past the eastern edge
    const pins = [
      { id: 'pin-far', position: fartherPin },
      { id: 'pin-close', position: closePin }
    ]
    const polygons = [{ id: 'poly-1', coordinates: square }]

    const results = matchPropertiesToPolygons(pins, polygons, { maxDistanceMeters: 1000 })
    const closeResult = results.find((r) => r.pinId === 'pin-close')
    const farResult = results.find((r) => r.pinId === 'pin-far')

    expect(closeResult.tier).toBe(MATCH_TIERS.NEAREST_BORDER)
    expect(closeResult.polygonId).toBe('poly-1')
    expect(farResult.polygonId).toBe(null)
    expect(farResult.tier).toBe(MATCH_TIERS.UNMATCHED)
  });

  it('lets a losing pin fall back to its next-nearest available polygon', () => {
    const nearSquare = squarePolygon(CENTER, 100)
    const secondCenter = pointAtDistanceFrom(CENTER, 50, 90)
    const secondSquare = squarePolygon(secondCenter, 100)

    // Both pins are closest to nearSquare, but pinB is closer to it than pinA.
    // pinA should fall back to secondSquare instead of going unmatched.
    const pinAPosition = pointAtDistanceFrom(CENTER, 300, 270)
    const pinBPosition = pointAtDistanceFrom(CENTER, 150, 270)
    const pins = [
      { id: 'pinA', position: pinAPosition },
      { id: 'pinB', position: pinBPosition }
    ]
    const polygons = [
      { id: 'poly-near', coordinates: nearSquare },
      { id: 'poly-second', coordinates: secondSquare }
    ]

    const results = matchPropertiesToPolygons(pins, polygons, { maxDistanceMeters: 1000 })
    const resultA = results.find((r) => r.pinId === 'pinA')
    const resultB = results.find((r) => r.pinId === 'pinB')

    expect(resultB.polygonId).toBe('poly-near')
    expect(resultA.polygonId).not.toBeNull()
    expect(resultA.polygonId).not.toBe(resultB.polygonId)
  });

  it('does not let a second pin with the same TP+FP steal an already-claimed polygon', () => {
    const pins = [
      { id: 'pin-1', tp: '82', fp: '5' },
      { id: 'pin-2', tp: '82', fp: '5' }
    ]
    const polygons = [{ id: 'poly-1', tp: '82', fp: '5', coordinates: square }]

    const results = matchPropertiesToPolygons(pins, polygons)
    const claimed = results.filter((r) => r.polygonId === 'poly-1')
    expect(claimed).toHaveLength(1)
    expect(results.find((r) => r.polygonId === null).tier).toBe(MATCH_TIERS.UNMATCHED)
  });

  it('leaves the pin unmatched when nothing is within the max distance', () => {
    const farAway = pointAtDistanceFrom(CENTER, 5000, 0);
    const pins = [{ id: 'pin-1', position: farAway }];
    const polygons = [{ id: 'poly-1', coordinates: square }];

    const [result] = matchPropertiesToPolygons(pins, polygons, { maxDistanceMeters: 1000 });
    expect(result).toEqual({
      pinId: 'pin-1',
      polygonId: null,
      tier: MATCH_TIERS.UNMATCHED,
      distanceMeters: null
    });
  });

  it('leaves a pin without coordinates unmatched instead of throwing', () => {
    const pins = [{ id: 'pin-1' }];
    const polygons = [{ id: 'poly-1', coordinates: square }];

    const [result] = matchPropertiesToPolygons(pins, polygons);
    expect(result.tier).toBe(MATCH_TIERS.UNMATCHED);
    expect(result.polygonId).toBeNull();
  });

  it('ignores polygons with fewer than 3 coordinates', () => {
    const pins = [{ id: 'pin-1', position: CENTER }];
    const polygons = [{ id: 'poly-1', coordinates: [{ lat: 21.17, lng: 72.831 }] }];

    const [result] = matchPropertiesToPolygons(pins, polygons);
    expect(result.tier).toBe(MATCH_TIERS.UNMATCHED);
  });
});
