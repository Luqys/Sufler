import { describe, expect, it } from 'vitest';
import { extractLinkTargets, polishPlural, resolveGraphEdges } from '../src/shared/graph';
import { createLayout, tick } from '../src/shared/graph-layout';

describe('extractLinkTargets', () => {
  it('wyciąga wikilinki z aliasami i nagłówkami', () => {
    expect(
      extractLinkTargets('Zobacz [[Baza danych]] i [[API|opis api]] oraz [[Notatka#sekcja]].'),
    ).toEqual(['Baza danych', 'API', 'Notatka']);
  });

  it('wyciąga linki markdown do .md, pomija URL-e', () => {
    expect(
      extractLinkTargets('[doc](docs/plan.md) [zew](https://x.pl/a.md) [kotwica](notes.md#top)'),
    ).toEqual(['docs/plan.md', 'notes.md']);
  });
});

describe('resolveGraphEdges', () => {
  const files = [
    { path: 'notatki/Architektura.md', content: 'Łączy [[Baza danych]] i [[api]].' },
    { path: 'notatki/Baza danych.md', content: 'Wraca do [[Architektura]].' },
    { path: 'notatki/api.md', content: 'Bez linków.' },
    { path: 'README.md', content: 'Ścieżka: [plan](notatki/api.md).' },
  ];

  it('rozwiązuje wikilinki po nazwie (bez względu na wielkość liter)', () => {
    const edges = resolveGraphEdges(files);
    const keys = edges.map((edge) => `${edge.from}→${edge.to}`);
    expect(keys).toContain('notatki/Architektura.md→notatki/Baza danych.md');
    expect(keys).toContain('notatki/Architektura.md→notatki/api.md');
    expect(keys).toContain('README.md→notatki/api.md');
  });

  it('deduplikuje pary nieskierowane (A→B i B→A to jedna krawędź)', () => {
    const edges = resolveGraphEdges(files);
    const pair = edges.filter(
      (edge) =>
        [edge.from, edge.to].includes('notatki/Architektura.md') &&
        [edge.from, edge.to].includes('notatki/Baza danych.md'),
    );
    expect(pair).toHaveLength(1);
    expect(edges).toHaveLength(3);
  });

  it('ignoruje linki do samego siebie i nieistniejących celów', () => {
    const edges = resolveGraphEdges([
      { path: 'a.md', content: '[[a]] i [[Nieistnieje]]' },
      { path: 'b.md', content: '' },
    ]);
    expect(edges).toHaveLength(0);
  });

  it('linki względne z podkatalogu', () => {
    const edges = resolveGraphEdges([
      { path: 'docs/a.md', content: '[w górę](../root.md)' },
      { path: 'root.md', content: '' },
    ]);
    expect(edges).toEqual([{ from: 'docs/a.md', to: 'root.md' }]);
  });
});

describe('graph-layout', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  // Para a–e startuje po przeciwnych stronach okręgu — bez krawędzi zostaje
  // daleko, sprężyna musi ją wyraźnie ściągnąć.
  const distanceAE = (edges: Array<{ from: string; to: string }>): number => {
    const layout = createLayout(ids, edges, 800, 600);
    for (let i = 0; i < 400; i++) {
      tick(layout);
    }
    const a = layout.nodes.get('a');
    const e = layout.nodes.get('e');
    if (!a || !e) {
      throw new Error('brak węzłów');
    }
    expect(Number.isFinite(a.x + a.y + e.x + e.y)).toBe(true);
    return Math.hypot(a.x - e.x, a.y - e.y);
  };

  it('sprężyna krawędzi przyciąga węzły względem układu bez krawędzi', () => {
    const withEdge = distanceAE([{ from: 'a', to: 'e' }]);
    const withoutEdge = distanceAE([]);
    expect(withEdge).toBeLessThan(withoutEdge * 0.8);
  });
});

describe('polishPlural', () => {
  it('odmienia notatki', () => {
    expect(polishPlural(1, 'notatka', 'notatki', 'notatek')).toBe('notatka');
    expect(polishPlural(3, 'notatka', 'notatki', 'notatek')).toBe('notatki');
    expect(polishPlural(15, 'notatka', 'notatki', 'notatek')).toBe('notatek');
    expect(polishPlural(22, 'notatka', 'notatki', 'notatek')).toBe('notatki');
  });
});
