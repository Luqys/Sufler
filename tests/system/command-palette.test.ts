import { describe, expect, it } from 'vitest';
import { filterActions, type PaletteItem } from '../../src/shared/system/command-palette';

const ITEMS: PaletteItem[] = [
  { id: 'panel:files', label: 'Pliki', group: 'Panele' },
  { id: 'panel:git', label: 'Historia git', group: 'Panele' },
  { id: 'dock:terminal', label: 'Nowy terminal', group: 'Doki' },
  { id: 'view:sidebar', label: 'Pokaż/ukryj panel boczny', group: 'Widok', hint: 'Cmd+B' },
  { id: 'theme:dark', label: 'Motyw ciemny', group: 'Motyw' },
];

describe('filterActions', () => {
  it('pusty tekst zwraca listę w kolejności katalogu', () => {
    const matches = filterActions(ITEMS, '');
    expect(matches.map((match) => match.item.id)).toEqual(ITEMS.map((item) => item.id));
    expect(matches.every((match) => match.positions.length === 0)).toBe(true);
  });

  it('same białe znaki traktujemy jak pusty tekst', () => {
    expect(filterActions(ITEMS, '   ')).toHaveLength(ITEMS.length);
  });

  it('filtruje po etykiecie i podświetla trafione znaki', () => {
    const matches = filterActions(ITEMS, 'term');
    expect(matches[0]?.item.id).toBe('dock:terminal');
    expect(matches[0]?.positions.length).toBe(4);
  });

  it('dopasowanie ciągłe wygrywa z rozsypanym', () => {
    const items: PaletteItem[] = [
      { id: 'rozsypane', label: 'Motyw rozjaśniony akcentem', group: 'g' },
      { id: 'ciagle', label: 'Motyw ciemny', group: 'g' },
    ];
    expect(filterActions(items, 'ciem')[0]?.item.id).toBe('ciagle');
  });

  it('trafienie w skrót działa, ale bez podświetlenia i po trafieniach w etykietę', () => {
    const matches = filterActions(ITEMS, 'cmd+b');
    expect(matches.map((match) => match.item.id)).toContain('view:sidebar');
    expect(matches.find((match) => match.item.id === 'view:sidebar')?.positions).toEqual([]);
  });

  it('nie zwraca nic, gdy nic nie pasuje', () => {
    expect(filterActions(ITEMS, 'zzzz')).toEqual([]);
  });

  it('respektuje limit wyników', () => {
    expect(filterActions(ITEMS, '', 2)).toHaveLength(2);
  });
});
