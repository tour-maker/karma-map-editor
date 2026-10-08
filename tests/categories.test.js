import { describe, it, expect } from 'vitest';
import {
  PROPERTY_TYPES, PROPERTY_TYPE_COLORS, normalizePropertyType, getPropertyTypeColor, getCategoryOptionsForUnit,
} from '../src/config/categories';

describe('Rented (lease) land category', () => {
  it('recognises the ways rented / lease land is written in the sheet', () => {
    ['Rent', 'RENT', 'Rented', 'RENTED', 'Rental', 'Lease', 'Leased', 'Leasehold', 'LEASEHOLD', 'On lease', 'Available for rent', 'RENT-Dumas']
      .forEach(raw => expect(normalizePropertyType(raw), raw).toBe('Rented'));
  });

  it('does not mistake other words or categories for it', () => {
    expect(normalizePropertyType('Parent')).not.toBe('Rented');
    expect(normalizePropertyType('Current')).not.toBe('Rented');
    expect(normalizePropertyType('Different')).not.toBe('Rented');
    expect(normalizePropertyType('Residential')).toBe('Residential');
    expect(normalizePropertyType('FreeHold')).toBe('Freehold');
    expect(normalizePropertyType('Commercial')).toBe('Commercial');
    expect(normalizePropertyType('Ready Farmhouse')).toBe('Ready Farmhouse');
    expect(normalizePropertyType('')).toBe('');
  });

  it('has its own colour, different from every other category', () => {
    const rented = PROPERTY_TYPE_COLORS.Rented;
    expect(rented).toBeTruthy();
    const others = PROPERTY_TYPES.filter(t => t !== 'Rented').map(t => PROPERTY_TYPE_COLORS[t]);
    expect(others).not.toContain(rented);
    expect(getPropertyTypeColor('Leasehold')).toBe(rented);
    expect(getPropertyTypeColor('Rented')).toBe(rented);
  });

  it('is offered as a category for both Sq Yard and Wingha', () => {
    expect(PROPERTY_TYPES).toContain('Rented');
    expect(getCategoryOptionsForUnit('yards')).toContain('Rented');
    expect(getCategoryOptionsForUnit('wingha')).toContain('Rented');
    expect(getCategoryOptionsForUnit(null)).toContain('Rented');
  });

  it('leaves the existing categories and colours untouched', () => {
    expect(PROPERTY_TYPE_COLORS.Freehold).toBe('#facc15');
    expect(PROPERTY_TYPE_COLORS.Residential).toBe('#38bdf8');
    expect(getPropertyTypeColor('Agriculture')).toBe('#22c55e');
  });
});

import { setCategories, CATEGORY_ALIASES } from '../src/config/categories';

describe('categories managed by the admin', () => {
  const defaults = PROPERTY_TYPES.map(name => ({ name, color: PROPERTY_TYPE_COLORS[name] }));
  const restore = () => setCategories(defaults);

  it('a new category gets its own colour and is recognised exactly', () => {
    setCategories([...defaults, { name: 'Plotted Scheme', color: '#123456' }]);
    expect(PROPERTY_TYPES).toContain('Plotted Scheme');
    expect(normalizePropertyType('plotted scheme')).toBe('Plotted Scheme');
    expect(getPropertyTypeColor('Plotted Scheme')).toBe('#123456');
    restore();
    expect(PROPERTY_TYPES).not.toContain('Plotted Scheme');
  });

  it('a renamed category keeps matching its old name, its loose spellings and its colour', () => {
    setCategories(defaults.map(c => c.name === 'Freehold' ? { ...c, name: 'Free Zone', aliases: ['Freehold'] } : c));
    expect(normalizePropertyType('Freehold')).toBe('Free Zone');
    expect(normalizePropertyType('FreeHold')).toBe('Free Zone');
    expect(normalizePropertyType('Free Zone')).toBe('Free Zone');
    expect(getPropertyTypeColor('FreeHold')).toBe('#facc15');
    expect(CATEGORY_ALIASES.freehold).toBe('Free Zone');
    restore();
    expect(normalizePropertyType('Freehold')).toBe('Freehold');
  });

  it('unit filters follow a renamed category', () => {
    setCategories(defaults.map(c => c.name === 'Industrial' ? { ...c, name: 'Factory', aliases: ['Industrial'] } : c));
    expect(getCategoryOptionsForUnit('yards')).not.toContain('Factory');
    restore();
  });

  it('ignores an empty list so a failed load keeps the current categories', () => {
    expect(setCategories([])).toBe(false);
    expect(PROPERTY_TYPES.length).toBeGreaterThan(0);
  });
});
