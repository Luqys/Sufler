/**
 * Szukanie w buforze terminala (M101): czysta logika nad tekstem wierszy,
 * bez xterma. Trafienie to pozycja w buforze — wiersz, kolumna, długość —
 * czyli dokładnie to, czego potrzebuje i przewijanie, i podświetlenie.
 */

export interface TerminalMatch {
  /** Numer wiersza w buforze (0 = najstarszy wiersz scrollbacku). */
  line: number;
  column: number;
  length: number;
}

/**
 * Wszystkie trafienia frazy, bez rozróżniania wielkości liter. Puste zapytanie
 * daje pustą listę — inaczej każde otwarcie szukajki „znajdowałoby" cały bufor.
 */
export function findMatches(lines: string[], query: string): TerminalMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [];
  }
  const matches: TerminalMatch[] = [];
  for (const [line, text] of lines.entries()) {
    const haystack = text.toLowerCase();
    let from = 0;
    for (;;) {
      const column = haystack.indexOf(needle, from);
      if (column === -1) {
        break;
      }
      matches.push({ line, column, length: needle.length });
      from = column + needle.length;
    }
  }
  return matches;
}

/** Numer następnego/poprzedniego trafienia, z zawijaniem. -1 gdy nie ma czego. */
export function stepMatch(count: number, current: number, direction: 1 | -1): number {
  if (count <= 0) {
    return -1;
  }
  if (current < 0) {
    return direction === 1 ? 0 : count - 1;
  }
  return (current + direction + count) % count;
}

/**
 * Pierwsze trafienie od dołu — szukamy w rozmowie, która toczy się w dół,
 * więc „ostatnio wspomniane" jest bliżej tego, o co pyta użytkownik.
 */
export function initialMatch(matches: TerminalMatch[]): number {
  return matches.length === 0 ? -1 : matches.length - 1;
}

/**
 * Wiersz, do którego przewijamy, żeby trafienie wypadło mniej więcej w środku
 * ekranu — skok dokładnie na trafienie kleiłby je do górnej krawędzi.
 */
export function scrollTargetLine(matchLine: number, rows: number): number {
  return Math.max(0, matchLine - Math.floor(rows / 2));
}
