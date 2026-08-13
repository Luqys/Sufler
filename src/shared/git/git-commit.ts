/**
 * Commit z aplikacji (M69): zaznaczasz pliki na liście zmian roboczych,
 * piszesz opis i zatwierdzasz bez wychodzenia do terminala. Czysta logika —
 * walidacja opisu, uzgodnienie zaznaczenia z aktualnym stanem drzewa
 * i higiena ścieżek przekazywanych gitowi.
 *
 * Świadomie poza zakresem (, M69): stage'owanie po
 * kawałkach i `push`. Zaznaczenie jest per plik, wypychanie zostaje
 * w terminalu.
 */

export type CommitMessageProblem = 'empty';

/** Opis commita jest wymagany — sam biały znak blokuje zatwierdzenie. */
export function commitMessageProblem(raw: string): CommitMessageProblem | null {
  return raw.trim() === '' ? 'empty' : null;
}

/**
 * Opis w postaci przekazywanej gitowi: bez spacji na końcach wierszy, bez
 * pustych wierszy na brzegach i bez ciągów pustych wierszy dłuższych niż
 * jeden. Dzięki temu `git log` wygląda tak samo jak commity pisane ręcznie.
 *
 * Wcięcie ucinamy TYLKO z pierwszego wiersza (wklejony temat nie ma prawa
 * zaczynać się od spacji); wcięcia w treści zostają, bo bywają zamierzone —
 * listy, fragmenty kodu, cytaty z logów.
 */
export function normalizeCommitMessage(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));
  const collapsed: string[] = [];
  for (const line of lines) {
    if (line === '' && collapsed[collapsed.length - 1] === '') {
      continue;
    }
    collapsed.push(line);
  }
  while (collapsed.length > 0 && collapsed[0] === '') {
    collapsed.shift();
  }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === '') {
    collapsed.pop();
  }
  if (collapsed.length > 0) {
    collapsed[0] = collapsed[0]?.trimStart() ?? '';
  }
  return collapsed.join('\n');
}

/** Pierwszy wiersz opisu — do komunikatu „zatwierdzono". */
export function commitSubject(raw: string, limit = 60): string {
  const first = normalizeCommitMessage(raw).split('\n')[0] ?? '';
  return first.length > limit ? `${first.slice(0, limit - 1)}…` : first;
}

/**
 * Ścieżka bezpieczna do przekazania gitowi: względna wobec korzenia projektu
 * i bez wychodzenia poza niego. Lista zmian pochodzi z `git status`, ale
 * przez IPC może przyjść cokolwiek — commit nie ma prawa dotknąć pliku
 * spoza projektu.
 */
export function isSafeRelativePath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.startsWith('\\')) {
    return false;
  }
  if (/^[a-zA-Z]:/.test(path)) {
    return false;
  }
  return !path.split('/').includes('..');
}

/**
 * Ścieżki, które faktycznie pójdą do commita: przecięcie zaznaczenia
 * z aktualną listą zmian. Zaznaczenie przeżywa odświeżenie panelu, więc plik
 * zatwierdzony w terminalu albo cofnięty nie może wjechać do commita
 * z rozpędu — po odświeżeniu znika z listy i wypada z przecięcia.
 */
export function plannedPaths(
  files: readonly { path: string }[],
  selected: Iterable<string>,
): string[] {
  const known = new Set(files.map((file) => file.path).filter(isSafeRelativePath));
  const planned = new Set<string>();
  for (const path of selected) {
    if (known.has(path)) {
      planned.add(path);
    }
  }
  return [...planned].sort();
}

/** Czy przycisk „Zatwierdź" ma być aktywny. */
export function canCommit(
  files: readonly { path: string }[],
  selected: Iterable<string>,
  message: string,
): boolean {
  return commitMessageProblem(message) === null && plannedPaths(files, selected).length > 0;
}
