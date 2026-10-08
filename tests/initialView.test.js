import { describe, it, expect } from 'vitest';
import { featuresForInitialView } from '../src/utils/initialView';

const plot = (id, lat, lng) => ({ id, coordinates: [{ lat, lng }, { lat: lat + 0.001, lng }, { lat, lng: lng + 0.001 }] });

describe('featuresForInitialView', () => {
  const surat = [plot('a', 21.17, 72.83), plot('b', 21.2, 72.78), plot('c', 21.05, 72.7), plot('d', 20.4, 72.9), plot('e', 21.7, 72.95)];
  const farAway = [plot('chennai', 12.77, 79.96), plot('udaipur', 24.6, 73.7), plot('hyd', 17.4, 78.5)];

  it('leaves out plots hundreds of km from the main cluster', () => {
    const ids = featuresForInitialView([...surat, ...farAway]).map(f => f.id);
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('keeps every plot of a normal Gujarat spread (Vapi to Bharuch)', () => {
    expect(featuresForInitialView(surat)).toHaveLength(5);
  });

  it('never returns nothing, and handles tiny or empty lists', () => {
    expect(featuresForInitialView([])).toEqual([]);
    expect(featuresForInitialView(farAway.slice(0, 2))).toHaveLength(2);
    expect(featuresForInitialView([plot('x', 12, 79), plot('y', 24, 73), plot('z', 17, 78)]).length).toBeGreaterThan(0);
  });
});
