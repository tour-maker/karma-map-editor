import { describe, it, expect } from 'vitest';
import { uniqueNames, collectSubAreas, matchExistingName, getAreaNovelty, displaySubArea } from '../src/utils/areaNames';

describe('uniqueNames', () => {
  it('merges names that differ only by capital letters (the "S1" / "s1" case)', () => {
    expect(uniqueNames(['S1', 's1'])).toEqual(['S1']);
    expect(uniqueNames(['s1', 'S1'])).toEqual(['s1']);
  });

  it('keeps the first spelling and the original order', () => {
    expect(uniqueNames(['Vesu', 'Adajan', 'VESU', 'adajan', 'Piplod'])).toEqual(['Vesu', 'Adajan', 'Piplod']);
  });

  it('ignores spaces around names and drops empty values', () => {
    expect(uniqueNames([' Vesu ', 'vesu', '', '   ', null, undefined, 'Adajan'])).toEqual(['Vesu', 'Adajan']);
  });

  it('keeps genuinely different names apart', () => {
    expect(uniqueNames(['New Althan', 'Althan'])).toEqual(['New Althan', 'Althan']);
  });

  it('handles no input', () => {
    expect(uniqueNames()).toEqual([]);
  });
});

describe('collectSubAreas', () => {
  const syncedAreas = [{ parent: 'p1', secondary: 'S1' }, { parent: 'p1', secondary: '' }, { parent: 'Surat', secondary: 'Vesu' }];
  const dynamicMap = { p1: ['s1'], P1: ['S1', 'extra'], Surat: ['Adajan'] };

  it('shows one entry for the same sub-area spelled two ways (the p1 / S1 screenshot)', () => {
    expect(collectSubAreas('p1', { syncedAreas, dynamicMap })).toEqual(['S1', 'extra']);
  });

  it('prefers the Areas sheet spelling', () => {
    expect(collectSubAreas('p1', { syncedAreas: [{ parent: 'p1', secondary: 's1' }], dynamicMap: { p1: ['S1'] } })).toEqual(['s1']);
  });

  it('treats a Primary spelled with different capitals as the same Primary', () => {
    expect(collectSubAreas('P1', { syncedAreas, dynamicMap })).toEqual(['S1', 'extra']);
  });

  it('only returns sub-areas of the asked Primary', () => {
    expect(collectSubAreas('Surat', { syncedAreas, dynamicMap })).toEqual(['Vesu', 'Adajan']);
  });

  it('also reads a static category map when given one', () => {
    expect(collectSubAreas('Surat', { categoryMap: { Surat: ['Vesu', 'Abhva'] }, dynamicMap: { Surat: ['vesu'] } })).toEqual(['Vesu', 'Abhva']);
  });

  it('returns an empty list for an empty or unknown Primary', () => {
    expect(collectSubAreas('', { syncedAreas, dynamicMap })).toEqual([]);
    expect(collectSubAreas('Nowhere', { syncedAreas, dynamicMap })).toEqual([]);
    expect(collectSubAreas(undefined)).toEqual([]);
  });
});


describe('matchExistingName', () => {
  it('reuses the existing spelling', () => {
    expect(matchExistingName(' surat ', ['Vapi', 'Surat'])).toBe('Surat');
  });
  it('keeps a new name as typed (trimmed)', () => {
    expect(matchExistingName(' Navsari ', ['Surat'])).toBe('Navsari');
  });
});

describe('getAreaNovelty', () => {
  const ctx = {
    syncedAreas: [{ parent: 'Surat', secondary: 'Adajan' }],
    dynamicMap: { Surat: ['Vesu'] },
    categoryMap: {}
  };
  it('existing area and sub is not new', () => {
    expect(getAreaNovelty('surat', 'adajan', ctx)).toEqual({ newParent: false, newSub: false });
  });
  it('existing primary with a new sub-area', () => {
    expect(getAreaNovelty('Surat', 'Pal', ctx)).toEqual({ newParent: false, newSub: true });
  });
  it('brand-new primary', () => {
    expect(getAreaNovelty('Navsari', 'Navsari', ctx)).toEqual({ newParent: true, newSub: false });
    expect(getAreaNovelty('Navsari', 'Dandi', ctx)).toEqual({ newParent: true, newSub: true });
  });
  it('empty input is not new', () => {
    expect(getAreaNovelty('', '', ctx)).toEqual({ newParent: false, newSub: false });
  });
});

describe('displaySubArea', () => {
  it('is empty when the location is just the primary', () => {
    expect(displaySubArea('Navsari', 'navsari')).toBe('');
    expect(displaySubArea('', 'Surat')).toBe('');
  });
  it('shows a real sub-area', () => {
    expect(displaySubArea('Adajan', 'Surat')).toBe('Adajan');
  });
});
