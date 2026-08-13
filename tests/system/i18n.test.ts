import { describe, expect, it } from 'vitest';
import { EN, PL, pluralForm, stringsFor, type StringKey } from '../../src/shared/i18n';

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

describe('słownik PL/EN', () => {
  it('ma identyczny zestaw kluczy (typ wymusza EN⊇PL, test łapie nadmiar w EN)', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(PL).sort());
  });

  it('placeholdery {x} zgadzają się między językami dla każdego klucza', () => {
    for (const key of Object.keys(PL) as StringKey[]) {
      expect(placeholders(EN[key]), `klucz ${key}`).toEqual(placeholders(PL[key]));
    }
  });

  it('stringsFor zwraca właściwy słownik', () => {
    expect(stringsFor('pl')['settings.title']).toBe('Ustawienia');
    expect(stringsFor('en')['settings.title']).toBe('Settings');
  });
});

describe('pluralForm', () => {
  const LINES = 'linia|linie|linii';

  it('polska odmiana: 1 / 2-4 / reszta, z wyjątkiem 12-14', () => {
    expect(pluralForm('pl', 1, LINES)).toBe('linia');
    expect(pluralForm('pl', 3, LINES)).toBe('linie');
    expect(pluralForm('pl', 5, LINES)).toBe('linii');
    expect(pluralForm('pl', 12, LINES)).toBe('linii');
    expect(pluralForm('pl', 14, LINES)).toBe('linii');
    expect(pluralForm('pl', 22, LINES)).toBe('linie');
    expect(pluralForm('pl', 112, LINES)).toBe('linii');
  });

  it('angielska odmiana: 1 / reszta', () => {
    expect(pluralForm('en', 1, 'note|notes')).toBe('note');
    expect(pluralForm('en', 2, 'note|notes')).toBe('notes');
    expect(pluralForm('en', 0, 'note|notes')).toBe('notes');
  });
});
