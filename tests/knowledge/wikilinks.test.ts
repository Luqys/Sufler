import { describe, expect, it } from 'vitest';
import { findWikilinks, noteIndexKey } from '../../src/shared/knowledge/wikilinks';

describe('findWikilinks', () => {
  it('znajduje nazwę z pozycjami 1-bazowymi obejmującymi samą nazwę', () => {
    const [link] = findWikilinks('Zobacz [[Beta]].');
    expect(link).toEqual({ name: 'Beta', line: 1, startColumn: 10, endColumn: 14 });
  });

  it('obsługuje aliasy, kotwice i wiele linków w wielu liniach', () => {
    const links = findWikilinks('[[Alfa|inna nazwa]] i [[Beta#sekcja]]\ndruga: [[Gamma]]');
    expect(links.map((entry) => entry.name)).toEqual(['Alfa', 'Beta', 'Gamma']);
    expect(links[2]?.line).toBe(2);
  });

  it('pomija puste i niezamknięte nawiasy', () => {
    expect(findWikilinks('[[ ]] oraz [[bez zamknięcia i [zwykły](link.md)')).toEqual([]);
  });
});

describe('noteIndexKey', () => {
  it('normalizuje wielkość liter i rozszerzenie .md', () => {
    expect(noteIndexKey('Moja Notatka.md')).toBe('moja notatka');
    expect(noteIndexKey('  Beta ')).toBe('beta');
  });
});
