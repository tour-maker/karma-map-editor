import { describe, it, expect } from 'vitest';
import { findPlotOrigins, describeOrigin } from '../src/utils/areaLog';

const events = [
  { action: 'rehome', createdAt: '2026-10-06', plots: [{ id: 'a', fromParent: 'Unassigned', fromLocation: 'Unassigned' }] },
  { action: 'delete-sub', area: 'Adajan', createdAt: '2026-10-05', by: 'admin', plots: [{ id: 'a', fromParent: 'Surat', fromLocation: 'Adajan' }, { id: 'b', fromParent: 'Surat', fromLocation: 'Adajan' }] },
  { action: 'delete-area', area: 'p1', createdAt: '2026-10-01', plots: [{ id: 'a', fromParent: 'p1', fromLocation: 'p1' }, { id: 'c', fromParent: 'p1', fromLocation: 'p1' }] }
];

describe('findPlotOrigins', () => {
  it('uses the newest delete event for each plot and ignores rehomes', () => {
    const origins = findPlotOrigins(events, ['a', 'b', 'c', 'z']);
    expect(origins.get('a').fromLocation).toBe('Adajan');
    expect(origins.get('b').deletedArea).toBe('Adajan');
    expect(origins.get('c').fromParent).toBe('p1');
    expect(origins.has('z')).toBe(false);
  });
});

describe('describeOrigin', () => {
  it('shows parent > sub-area, or just the area', () => {
    expect(describeOrigin({ fromParent: 'Surat', fromLocation: 'Adajan' })).toBe('Surat > Adajan');
    expect(describeOrigin({ fromParent: 'p1', fromLocation: 'P1' })).toBe('p1');
    expect(describeOrigin(null)).toBe('');
  });
});
