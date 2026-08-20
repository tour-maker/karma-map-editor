import { describe, it, expect } from 'vitest';
import { validateFeature } from '../src/utils/validation';

describe('Validation Utilities', () => {
  it('validates a correct polygon feature', () => {
    const validFeature = {
      id: 'test-1',
      source: 'drawn',
      type: 'polygon',
      coordinates: [
        { lat: 10, lng: 10 },
        { lat: 10, lng: 20 },
        { lat: 20, lng: 20 },
      ],
      center: { lat: 15, lng: 15 },
      data: { name: 'Test Polygon' }
    };
    const result = validateFeature(validFeature);
    expect(result).toEqual(validFeature);
  });

  it('throws on missing required fields', () => {
    const invalidFeature = {
      source: 'drawn',
      // missing id
    };
    expect(() => validateFeature(invalidFeature)).toThrow();
  });
});
