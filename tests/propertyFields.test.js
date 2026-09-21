import { describe, it, expect } from 'vitest';
import { isMeaningfulValue, resolveTpOpFp } from '../src/utils/propertyFields';

describe('isMeaningfulValue', () => {
  it('hides only null/undefined/blank/"-"', () => {
    expect(isMeaningfulValue(undefined)).toBe(false);
    expect(isMeaningfulValue(null)).toBe(false);
    expect(isMeaningfulValue('')).toBe(false);
    expect(isMeaningfulValue('   ')).toBe(false);
    expect(isMeaningfulValue('-')).toBe(false);
    expect(isMeaningfulValue(' - ')).toBe(false);
  });

  it('keeps real data, including 0 and dashes inside a value', () => {
    expect(isMeaningfulValue('7')).toBe(true);
    expect(isMeaningfulValue(' 47 ')).toBe(true);
    expect(isMeaningfulValue(0)).toBe(true);
    expect(isMeaningfulValue('0')).toBe(true);
    expect(isMeaningfulValue('12-A')).toBe(true);
    expect(isMeaningfulValue('- Long Leased')).toBe(true);
  });
});

describe('resolveTpOpFp', () => {
  it('sheet row s02 (TP 7, OP "-", FP 47) shows TP and FP, hides OP', () => {
    expect(resolveTpOpFp({ tp: '7', op: '-', fp: '47' })).toEqual({ tp: '7', fp: '47' });
  });

  it('shows all three when all are real', () => {
    expect(resolveTpOpFp({ tp: '7', op: '3', fp: '47' })).toEqual({ tp: '7', op: '3', fp: '47' });
  });

  it('recovers real values from the name when the column holds a dash', () => {
    expect(resolveTpOpFp({ tp: '-', op: '-', fp: '', name: 'TP 7 OP 12 FP 47' }))
      .toEqual({ tp: '7', op: '12', fp: '47' });
  });

  it('does not invent values from words like "opp." or "shop"', () => {
    expect(resolveTpOpFp({ tp: '7', op: '', fp: '', name: 'opp. shiv krupa, shop 4' })).toEqual({ tp: '7' });
  });

  it('a dash in the name is not a value', () => {
    expect(resolveTpOpFp({ name: 'TP: 7 | OP: - | FP: 47' })).toEqual({ tp: '7', fp: '47' });
  });
});
