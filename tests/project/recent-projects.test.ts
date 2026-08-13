import { describe, expect, it } from 'vitest';
import { projectHint, recentProjectsFor } from '../../src/shared/project/recent-projects';

const ROOTS = [
  '/Users/kto/Desktop/VisualN3O',
  '/Users/kto/praca/sklep',
  '/Users/kto/praca/sklep', // duplikat z listy ostatnich
  '/Users/kto/Desktop/notatki/',
  '/opt/repo',
];

describe('recentProjectsFor', () => {
  it('rozbija ścieżkę na nazwę i katalog nadrzędny', () => {
    const [first] = recentProjectsFor(ROOTS, null);
    expect(first).toEqual({
      path: '/Users/kto/Desktop/VisualN3O',
      name: 'VisualN3O',
      parent: '/Users/kto/Desktop',
    });
  });

  it('pomija bieżący projekt — przełączanie na siebie nic nie robi', () => {
    const paths = recentProjectsFor(ROOTS, '/Users/kto/Desktop/VisualN3O').map((p) => p.path);
    expect(paths).not.toContain('/Users/kto/Desktop/VisualN3O');
  });

  it('bieżący projekt z ukośnikiem na końcu to ten sam projekt', () => {
    const paths = recentProjectsFor(ROOTS, '/Users/kto/Desktop/VisualN3O/').map((p) => p.path);
    expect(paths).not.toContain('/Users/kto/Desktop/VisualN3O');
  });

  it('znosi duplikaty i ucina końcowe ukośniki', () => {
    const paths = recentProjectsFor(ROOTS, null).map((p) => p.path);
    expect(paths.filter((path) => path === '/Users/kto/praca/sklep')).toHaveLength(1);
    expect(paths).toContain('/Users/kto/Desktop/notatki');
  });

  it('zachowuje kolejność z main (od ostatnio otwartego) i respektuje limit', () => {
    const paths = recentProjectsFor(ROOTS, null, 2).map((p) => p.name);
    expect(paths).toEqual(['VisualN3O', 'sklep']);
  });

  it('pusta lista i same puste ścieżki nie produkują wpisów', () => {
    expect(recentProjectsFor([], null)).toEqual([]);
    expect(recentProjectsFor(['', '/'], null)).toEqual([]);
  });
});

describe('projectHint', () => {
  const home = '/Users/kto';

  it('skraca katalog domowy do tyldy i pokazuje ostatni element', () => {
    const project = { path: '/Users/kto/praca/sklep', name: 'sklep', parent: '/Users/kto/praca' };
    expect(projectHint(project, home)).toBe('…/praca');
  });

  it('płytka ścieżka zostaje w całości', () => {
    const project = { path: '/opt/repo', name: 'repo', parent: '/opt' };
    expect(projectHint(project, home)).toBe('/opt');
  });

  it('projekt w korzeniu systemu ma sensowną podpowiedź', () => {
    const project = { path: '/repo', name: 'repo', parent: '' };
    expect(projectHint(project, home)).toBe('/');
  });
});
