/**
 * Nowy folder roboczy z ekranu startowego (M76). Czysta logika: walidacja
 * nazwy i budowa ścieżki docelowej — te same reguły w rendererze (podgląd
 * ścieżki i komunikat pod polem) i w main (ostatnie słowo przed `mkdir`).
 */

export type ProjectNameProblem =
  | 'empty'
  /** Ukośnik albo dwukropek — to już ścieżka, nie nazwa folderu. */
  | 'separator'
  /** Kropka na początku ukrywa folder w Finderze; „.” i „..” nie są nazwami. */
  | 'dot'
  /** Znaki, które psują ścieżki w powłoce i na innych systemach. */
  | 'invalid'
  | 'too-long';

/** macOS przyjmuje 255 bajtów na składową ścieżki; z zapasem na diakrytyki. */
const MAX_NAME_LENGTH = 120;

/** Znaki, które psują ścieżki w powłoce albo na innych systemach plików. */
const FORBIDDEN_CHARACTERS = new Set(['<', '>', '"', '|', '?', '*', '\\']);

/** Znak kontrolny (poniżej spacji) — w nazwie nie ma po nim śladu, a psuje ścieżkę. */
function isControl(character: string): boolean {
  return (character.codePointAt(0) ?? 0) < 0x20;
}

/** null = nazwa w porządku. */
export function projectNameProblem(name: string): ProjectNameProblem | null {
  const trimmed = name.trim();
  if (trimmed === '') {
    return 'empty';
  }
  if (trimmed.includes('/') || trimmed.includes(':')) {
    return 'separator';
  }
  if (trimmed.startsWith('.')) {
    return 'dot';
  }
  if ([...trimmed].some((c) => FORBIDDEN_CHARACTERS.has(c) || isControl(c))) {
    return 'invalid';
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return 'too-long';
  }
  return null;
}

/** Ścieżka docelowa nowego projektu; null, gdy nazwa albo lokalizacja odpada. */
export function projectTargetPath(parent: string, name: string): string | null {
  const trimmedParent = parent.trim();
  if (trimmedParent === '' || projectNameProblem(name) !== null) {
    return null;
  }
  const base = trimmedParent.endsWith('/') ? trimmedParent.slice(0, -1) : trimmedParent;
  return `${base}/${name.trim()}`;
}
