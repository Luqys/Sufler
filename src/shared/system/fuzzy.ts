/**
 * Szybkie otwieranie plików Cmd+P (M37): dopasowanie rozmyte po nazwie.
 * Czysta logika — podciąg znaków z premiami za początki segmentów,
 * ciągłość i trafienia w nazwie pliku.
 */

export interface FuzzyMatch {
  path: string;
  score: number;
  /** Indeksy trafionych znaków (0-bazowe) — do pogrubienia w liście. */
  positions: number[];
}

const SEGMENT_STARTERS = new Set(['/', '.', '-', '_', ' ']);

export function fuzzyMatch(
  query: string,
  candidate: string,
): { score: number; positions: number[] } | null {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (q.length === 0) {
    return { score: 0, positions: [] };
  }
  if (q.length > c.length) {
    return null;
  }
  const lastSlash = c.lastIndexOf('/');
  const baseStart = lastSlash + 1;

  const positions: number[] = [];
  let score = 0;
  let qi = 0;
  let previous = -2;
  for (let ci = 0; ci < c.length && qi < q.length; ci += 1) {
    if (c[ci] !== q[qi]) {
      continue;
    }
    positions.push(ci);
    score += 1;
    if (ci === previous + 1) {
      score += 8;
    }
    if (ci === 0 || SEGMENT_STARTERS.has(c[ci - 1] ?? '')) {
      score += 6;
    }
    if (ci >= baseStart) {
      score += 4;
    }
    previous = ci;
    qi += 1;
  }
  if (qi < q.length) {
    return null;
  }
  if (c.startsWith(q, baseStart)) {
    // Nazwa pliku zaczyna się od zapytania — najmocniejszy sygnał.
    score += 50;
  }
  // Przy równych trafieniach wygrywa krótsza ścieżka.
  return { score: score * 1000 - candidate.length, positions };
}

export function filterPaths(paths: string[], query: string, limit = 50): FuzzyMatch[] {
  const matches: FuzzyMatch[] = [];
  for (const path of paths) {
    const match = fuzzyMatch(query, path);
    if (match) {
      matches.push({ path, ...match });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return matches.slice(0, limit);
}
