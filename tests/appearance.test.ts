import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '../src/shared/appearance';

describe('normalizeAppearance', () => {
  it('przyjmuje wszystkie tryby, w tym matrix', () => {
    expect(normalizeAppearance({ mode: 'matrix', accent: 'green' })).toEqual({
      mode: 'matrix',
      accent: 'green',
    });
    expect(normalizeAppearance({ mode: 'dark', accent: 'clay' })).toEqual({
      mode: 'dark',
      accent: 'clay',
    });
  });

  it('nieznane wartości i śmieci wracają do domyślnych', () => {
    expect(normalizeAppearance({ mode: 'neon', accent: 'złoto' })).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance('matrix')).toEqual(DEFAULT_APPEARANCE);
  });
});
