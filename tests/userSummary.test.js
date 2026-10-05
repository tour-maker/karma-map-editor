import { describe, it, expect } from 'vitest';
import { getUserDisplayName, countValues } from '../src/utils/userSummary';

describe('getUserDisplayName', () => {
  it('joins first and last name', () => {
    expect(getUserDisplayName({ firstName: ' Asha ', lastName: 'Patel' })).toBe('Asha Patel');
  });
  it('returns empty for older accounts without a name', () => {
    expect(getUserDisplayName({ username: '9999999999' })).toBe('');
    expect(getUserDisplayName()).toBe('');
  });
});

describe('countValues', () => {
  it('counts ignoring case, drops empties, sorts by count', () => {
    expect(countValues(['Surat', 'surat', '', null, 'Vapi', 'Surat'])).toEqual([
      { name: 'Surat', count: 3 },
      { name: 'Vapi', count: 1 }
    ]);
  });
  it('handles missing input', () => {
    expect(countValues()).toEqual([]);
  });
});
