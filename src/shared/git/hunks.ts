/**
 * Commit po kawałkach (M85). W M69 zaznaczenie było per plik, a stage'owanie
 * fragmentów odłożyłem jako „osobną mechanikę" — i słusznie: żeby zatwierdzić
 * część zmian w pliku, trzeba zbudować łatkę z wybranych hunków i wpuścić ją
 * do indeksu (`git apply --cached`), a potem commitować INDEKS, nie drzewo.
 *
 * Tutaj wyłącznie parsowanie i składanie łatki — testowane jednostkowo,
 * a w testach integracyjnych sprawdzane prawdziwym `git apply`.
 */

export interface Hunk {
  /** Nagłówek `@@ -a,b +c,d @@` z ewentualnym ogonem (nazwa funkcji). */
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  /** Wiersze hunka z prefiksami ` `, `+`, `-`, `\`. */
  lines: string[];
}

export interface FileDiff {
  /** Ścieżka względem korzenia repozytorium (strona „po"). */
  path: string;
  /** Wiersze nagłówka pliku: `diff --git`, `index`, `---`, `+++`, tryby. */
  head: string[];
  hunks: Hunk[];
  /** true dla plików binarnych — tych nie da się dzielić na kawałki. */
  binary: boolean;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function pathFromPlusLine(line: string): string {
  const raw = line.slice('+++ '.length).trim();
  return raw === '/dev/null' ? '' : raw.replace(/^b\//, '');
}

/** Rozbija wyjście `git diff` na pliki i hunki. */
export function parseUnifiedDiff(stdout: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | null = null;
  let hunk: Hunk | null = null;

  const closeHunk = (): void => {
    if (file !== null && hunk !== null) {
      file.hunks.push(hunk);
    }
    hunk = null;
  };

  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('diff --git ')) {
      closeHunk();
      file = { path: '', head: [line], hunks: [], binary: false };
      files.push(file);
      continue;
    }
    if (file === null) {
      continue;
    }
    if (hunk === null && line.startsWith('Binary files ')) {
      file.binary = true;
      continue;
    }
    const match = HUNK_HEADER.exec(line);
    if (match) {
      closeHunk();
      hunk = {
        header: line,
        oldStart: Number(match[1]),
        oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        newCount: match[4] === undefined ? 1 : Number(match[4]),
        lines: [],
      };
      continue;
    }
    if (hunk !== null) {
      if (line === '' || /^[ +\-\\]/.test(line)) {
        hunk.lines.push(line);
        continue;
      }
      closeHunk();
    }
    if (line.startsWith('+++ ')) {
      file.path = pathFromPlusLine(line);
    }
    file.head.push(line);
  }
  closeHunk();
  return files.filter((entry) => entry.head.length > 0);
}

/** Ile wierszy hunk dodaje i ile usuwa — do podpisu przy zaznaczeniu. */
export function hunkStats(hunk: Hunk): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of hunk.lines) {
    if (line.startsWith('+')) {
      added += 1;
    } else if (line.startsWith('-')) {
      removed += 1;
    }
  }
  return { added, removed };
}

/** Pierwszy dodany albo usunięty wiersz — podgląd hunka na liście. */
export function hunkPreview(hunk: Hunk, limit = 80): string {
  const line = hunk.lines.find((entry) => entry.startsWith('+') || entry.startsWith('-')) ?? '';
  const text = line.slice(1).trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/**
 * Łatka z wybranych hunków jednego pliku.
 *
 * Strona „przed" zostaje bez zmian (odnosi się do oryginału), ale początek
 * strony „po" trzeba PRZELICZYĆ: pominięte hunki nie zmieniają pliku, więc
 * numeracja po ich stronie się przesuwa. Bez tego `git apply` odrzuca łatkę
 * przy drugim i kolejnych hunkach.
 */
export function buildPatch(file: FileDiff, selected: Iterable<number>): string {
  const wanted = [...new Set(selected)].sort((a, b) => a - b);
  const hunks = wanted
    .map((index) => file.hunks[index])
    .filter((hunk): hunk is Hunk => hunk !== undefined);
  if (hunks.length === 0) {
    return '';
  }
  const parts = [...file.head];
  let offset = 0;
  for (const hunk of hunks) {
    const newStart = hunk.oldStart + offset;
    const oldPart = hunk.oldCount === 1 ? `${hunk.oldStart}` : `${hunk.oldStart},${hunk.oldCount}`;
    const newPart = hunk.newCount === 1 ? `${newStart}` : `${newStart},${hunk.newCount}`;
    const tail = hunk.header.slice(hunk.header.indexOf('@@', 2) + 2);
    parts.push(`@@ -${oldPart} +${newPart} @@${tail}`);
    parts.push(...hunk.lines);
    offset += hunk.newCount - hunk.oldCount;
  }
  // `git apply` wymaga znaku końca linii na końcu łatki.
  return `${parts.join('\n')}\n`;
}
