import { describe, expect, it } from 'vitest';
import {
  CATEGORY_FALLBACK,
  classifyNote,
  extractTags,
  LAYER_BACKEND,
  LAYER_BOTH,
  LAYER_FRONTEND,
  LAYER_NONE,
  normalizeLayer,
} from '../../src/shared/knowledge/knowledge-categories';

describe('classifyNote', () => {
  it('frontmatter ma pierwszeństwo przed heurystyką', () => {
    const note =
      '---\nkategoria: Płatności\nwarstwa: backend\n---\n\n# Widok koszyka\n\nKomponent React i styl przycisku.\n';
    expect(classifyNote('sklep.md', note)).toEqual({
      category: 'Płatności',
      layer: LAYER_BACKEND,
    });
  });

  it('frontmatter może uzupełniać tylko jedną z kategorii', () => {
    const note = '---\nkategoria: Rozliczenia\n---\n\n# Serwer\n\nEndpoint API.\n';
    expect(classifyNote('rozliczenia.md', note)).toEqual({
      category: 'Rozliczenia',
      layer: LAYER_BACKEND,
    });
  });

  it('notatka o interfejsie → Interfejs / Frontend', () => {
    const note = '# Ekran logowania\n\nKomponent React, styl przycisku w CSS.\n';
    expect(classifyNote('ekran.md', note)).toEqual({
      category: 'Interfejs',
      layer: LAYER_FRONTEND,
    });
  });

  it('notatka o API i bazie → API / Backend', () => {
    const note = '# Serwer API\n\nEndpoint REST zapisuje do bazy danych (SQL).\n';
    expect(classifyNote('serwer.md', note)).toEqual({
      category: 'API',
      layer: LAYER_BACKEND,
    });
  });

  it('sygnały z obu stron → Frontend + backend', () => {
    const note = '# Przepływ zapisu\n\nWidok wysyła żądanie do serwera przez API.\n';
    expect(classifyNote('przeplyw.md', note).layer).toBe(LAYER_BOTH);
  });

  it('bez sygnałów → kategorie ogólne', () => {
    const note = '# Plan spotkania\n\nOmówić budżet i terminy.\n';
    expect(classifyNote('plan.md', note)).toEqual({
      category: CATEGORY_FALLBACK,
      layer: LAYER_NONE,
    });
  });

  it('ścieżka pliku też liczy się do heurystyki', () => {
    expect(classifyNote('testy/scenariusze.md', '# Scenariusze\n').category).toBe('Testy');
  });

  it('polskie odmiany słów kluczowych są łapane', () => {
    const note = '# Notatka\n\nOpis stylów i przycisków w motywie ciemnym.\n';
    expect(classifyNote('n.md', note).category).toBe('Interfejs');
  });

  it('krótkie słowa wymagają granic — „restart" to nie REST', () => {
    const note = '# Notatka\n\nPo restarcie aplikacja wstaje sama.\n';
    expect(classifyNote('n.md', note).category).toBe(CATEGORY_FALLBACK);
  });
});

describe('normalizeLayer', () => {
  it('sprowadza zapisy frontmattera do wspólnych etykiet', () => {
    expect(normalizeLayer('FRONTEND')).toBe(LAYER_FRONTEND);
    expect(normalizeLayer('back-end')).toBe(LAYER_BACKEND);
    expect(normalizeLayer('pełny stos')).toBe(LAYER_BOTH);
    expect(normalizeLayer('frontend i backend')).toBe(LAYER_BOTH);
  });

  it('nieznaną wartość zostawia jako własną etykietę', () => {
    expect(normalizeLayer('infrastruktura')).toBe('Infrastruktura');
  });
});

describe('extractTags', () => {
  it('czyta listę YAML z `tagi:`, normalizuje # i wielkość liter, deduplikuje', () => {
    const note = '---\ntagi: [Projekt, "#Backend", projekt]\n---\n\n# N\n';
    expect(extractTags(note)).toEqual(['projekt', 'backend']);
  });

  it('akceptuje zapis po przecinkach oraz klucz `tags:`', () => {
    // Wartość w cudzysłowie — goły „ #…" YAML ściąłby jako komentarz.
    expect(extractTags('---\ntags: "alfa, Beta,, #gamma"\n---\n')).toEqual([
      'alfa',
      'beta',
      'gamma',
    ]);
  });

  it('bez frontmattera lub bez klucza zwraca pustą listę', () => {
    expect(extractTags('# Notatka bez tagów\n')).toEqual([]);
    expect(extractTags('---\nkategoria: X\n---\n')).toEqual([]);
  });

  it('wartość liczbową traktuje jak pojedynczy tag', () => {
    expect(extractTags('---\ntagi: 2026\n---\n')).toEqual(['2026']);
  });
});
