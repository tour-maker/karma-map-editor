import { describe, it, expect } from 'vitest';
import { applyAreaChange } from '../src/utils/areaSelection';

const SUBS = { Surat: ['Vesu', 'Adajan'], Kosamba: ['Ast'], S1: ['S1'], Navsari: [] };
const ctx = {
  subsFor: (parent) => SUBS[parent] || [],
  deriveParent: (loc) => (['Vesu', 'Adajan'].includes(loc) ? 'Surat' : loc),
};

describe('applyAreaChange', () => {
  it('keeps the chosen Primary when a Secondary is picked (the "Ast under Kosamba" bug)', () => {
    const next = applyAreaChange({ parentLocation: 'Kosamba', location: 'Kosamba' }, 'location', 'Ast', ctx);
    expect(next.parentLocation).toBe('Kosamba');
    expect(next.location).toBe('Ast');
  });

  it('works for a Primary and Secondary that share a name (S1 / S1)', () => {
    const next = applyAreaChange({ parentLocation: 'S1', location: '' }, 'location', 'S1', ctx);
    expect(next).toMatchObject({ parentLocation: 'S1', location: 'S1' });
  });

  it('only guesses the Primary when none is selected yet', () => {
    expect(applyAreaChange({ parentLocation: '', location: '' }, 'location', 'Vesu', ctx).parentLocation).toBe('Surat');
  });

  it('keeps the current Secondary when it belongs to the newly chosen Primary', () => {
    const next = applyAreaChange({ parentLocation: 'Kosamba', location: 'ast' }, 'parentLocation', 'Kosamba', ctx);
    expect(next.location).toBe('ast');
  });

  it('clears the Secondary when the new Primary has sub-areas to choose from', () => {
    const next = applyAreaChange({ parentLocation: 'Kosamba', location: 'Ast' }, 'parentLocation', 'Surat', ctx);
    expect(next).toMatchObject({ parentLocation: 'Surat', location: '' });
  });

  it('places the plot directly under a Primary that has no sub-areas', () => {
    const next = applyAreaChange({ parentLocation: 'Surat', location: 'Vesu' }, 'parentLocation', 'Navsari', ctx);
    expect(next).toMatchObject({ parentLocation: 'Navsari', location: 'Navsari' });
  });

  it('leaves other fields untouched', () => {
    const prev = { parentLocation: 'Surat', location: 'Vesu', landmark: '' };
    expect(applyAreaChange(prev, 'landmark', 'near mall', ctx)).toEqual({ ...prev, landmark: 'near mall' });
  });
});
