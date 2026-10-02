import { describe, it, expect } from 'vitest';
import { getCoordinatesCenter, SUBMISSION_FOCUS_ZOOM } from '../src/utils/submissionLocation';

describe('getCoordinatesCenter', () => {
  it('returns the centre of the polygon bounding box', () => {
    const square = [
      { lat: 21.0, lng: 72.0 }, { lat: 21.0, lng: 72.2 },
      { lat: 21.2, lng: 72.2 }, { lat: 21.2, lng: 72.0 },
    ];
    const c = getCoordinatesCenter(square);
    expect(c.lat).toBeCloseTo(21.1);
    expect(c.lng).toBeCloseTo(72.1);
  });

  it('accepts numeric strings (as stored by older submissions)', () => {
    const c = getCoordinatesCenter([{ lat: '21', lng: '72' }, { lat: '22', lng: '73' }]);
    expect(c).toEqual({ lat: 21.5, lng: 72.5 });
  });

  it('ignores broken points and still finds a centre from the good ones', () => {
    const c = getCoordinatesCenter([null, { lat: 'x', lng: 1 }, { lat: 21, lng: 72 }, { lat: 23, lng: 74 }, {}]);
    expect(c).toEqual({ lat: 22, lng: 73 });
  });

  it('returns null when there is nothing usable', () => {
    expect(getCoordinatesCenter([])).toBeNull();
    expect(getCoordinatesCenter(undefined)).toBeNull();
    expect(getCoordinatesCenter([{ lat: 'x', lng: 'y' }, null])).toBeNull();
  });

  it('uses a plot-level zoom', () => {
    expect(SUBMISSION_FOCUS_ZOOM).toBe(17);
  });
});
