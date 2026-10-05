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
