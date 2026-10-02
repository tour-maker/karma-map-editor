import { describe, it, expect } from 'vitest';
import { getParentsWithProperties, hasPropertyInLocation } from '../src/utils/locationAvailability';

const coords = [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }, { lat: 2, lng: 2 }];
const plot = (id, data, extra = {}) => ({ id, type: 'polygon', coordinates: coords, data, style: { visible: true }, ...extra });

const features = [
  plot('s1', { location: 'Vesu', parentLocation: 'Surat', type: 'Freehold', areaUnit: 'Sq Yard' }),
  plot('w1', { location: 'Kosamba', parentLocation: 'Kosamba', type: 'Agriculture', areaUnit: 'Wingha' }),
  plot('s2', { location: 'Adajan', parentLocation: 'Surat', type: 'Residential', areaUnit: 'Sq Yard' }, { style: { visible: false } }),
  // A landmark pin near Abhva: must never make "Abhva" count as having a property.
  { id: 'lm1', type: 'marker', position: { lat: 1, lng: 1 }, data: { name: 'Abhva Chokdi', landmark: 'Abhva Chokdi', location: 'Abhva', type: 'Landmark' }, style: { visible: true } },
  // A polygon-shaped feature flagged as a landmark is not a property either.
  plot('lm-2', { location: 'Piplod', parentLocation: 'Surat', type: 'Landmark' }),
];

describe('location availability', () => {
  it('only lists primary locations that have at least one property', () => {
    expect([...getParentsWithProperties(features)].sort()).toEqual(['Kosamba', 'Surat']);
  });

  it('never counts a landmark location as having properties', () => {
    expect(hasPropertyInLocation(features, 'Abhva')).toBe(false);
    expect(hasPropertyInLocation(features, 'Piplod')).toBe(false);
  });

  it('ignores hidden properties', () => {
    expect(hasPropertyInLocation(features, 'Adajan')).toBe(false);
    expect(hasPropertyInLocation(features, 'Vesu')).toBe(true);
  });

  it('respects the active area unit', () => {
    expect([...getParentsWithProperties(features, 'yards')]).toEqual(['Surat']);
    expect([...getParentsWithProperties(features, 'wingha')]).toEqual(['Kosamba']);
    expect(hasPropertyInLocation(features, 'Kosamba', 'yards')).toBe(false);
  });

  it('respects the active category', () => {
    expect([...getParentsWithProperties(features, null, 'Freehold')]).toEqual(['Surat']);
    expect(hasPropertyInLocation(features, 'Vesu', null, 'Commercial')).toBe(false);
  });

  it('a location with one property is shown, one with none is not', () => {
    const withNew = [...features, plot('s9', { location: 'Abhva', parentLocation: 'Surat', type: 'Freehold', areaUnit: 'Sq Yard' })];
    expect(hasPropertyInLocation(withNew, 'Abhva')).toBe(true);
  });

  it('matches the category regardless of how the sheet spells it', () => {
    // Real case: the sheet says "FreeHold" while the filter option is "Freehold".
    const sheetSpelling = [plot('s118', { location: 'Abhva', parentLocation: 'Surat', type: 'FreeHold', areaUnit: 'Sq Yard' })];
    expect(hasPropertyInLocation(sheetSpelling, 'Abhva', 'yards', 'Freehold')).toBe(true);
    expect([...getParentsWithProperties(sheetSpelling, 'yards', 'Freehold')]).toEqual(['Surat']);
    expect(hasPropertyInLocation(sheetSpelling, 'Abhva', 'yards', 'Commercial')).toBe(false);
  });

  it('handles an empty feature list', () => {
    expect(getParentsWithProperties([]).size).toBe(0);
  });
});
