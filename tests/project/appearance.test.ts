import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '../../src/shared/project/appearance';

describe('normalizeAppearance', () => {
  it('przyjmuje wszystkie tryby, w tym matrix', () => {
    expect(normalizeAppearance({ mode: 'matrix', accent: 'green' })).toEqual({
      mode: 'matrix',
      accent: 'green',
      language: 'pl',
    });
    expect(normalizeAppearance({ mode: 'dark', accent: 'clay', language: 'en' })).toEqual({
      mode: 'dark',
      accent: 'clay',
      language: 'en',
    });
  });

  it('nieznane wartości i śmieci wracają do domyślnych', () => {
    expect(normalizeAppearance({ mode: 'neon', accent: 'złoto', language: 'de' })).toEqual(
      DEFAULT_APPEARANCE,
    );
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance('matrix')).toEqual(DEFAULT_APPEARANCE);
  });

  it('domyślny język to polski', () => {
    expect(DEFAULT_APPEARANCE.language).toBe('pl');
  });
});
