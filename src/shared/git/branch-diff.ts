/**
 * Porównanie gałęzi worktree'a z bazą (M86). W M72 zapisałem w spec-u, że to
 * wymaga diffa „między katalogami roboczymi" i dlatego wypada z zakresu —
 * to była pomyłka: gałąź worktree'a jest zwykłą gałęzią TEGO SAMEGO
 * repozytorium, więc wystarczy `git diff <baza>...<gałąź>` z korzenia,
 * a istniejąca zakładka diffa (`kind: 'commit'`) pokaże każdy plik.
 *
 * Czysta logika: parser `--name-status -z` i porządkowanie listy.
 */

export interface BranchDiffFile {
  /** Litera statusu gita: A, M, D, R, C, T. */
  status: string;
  /** Ścieżka względem korzenia repozytorium (przy zmianie nazwy — nowa). */
  path: string;
  /** Poprzednia ścieżka dla R/C; pusta dla reszty. */
  oldPath: string;
}

export interface BranchDiff {
  /** Gałąź bazowa, wobec której liczymy różnicę. */
  base: string;
  /** Commit rozejścia się gałęzi — druga strona diffa. */
  mergeBase: string;
  /**
   * Czubek porównywanej gałęzi jako sha. Zakładka diffa dostaje SHA, nie nazwę
   * gałęzi: `runGitShowFile` przepuszcza wyłącznie `HEAD` i sha (ochrona przed
   * wstrzyknięciem do `git show <rev>:<ścieżka>`), a przy okazji porównanie
   * zostaje przypięte do rewizji, którą faktycznie policzyliśmy.
   */
  tip: string;
  files: BranchDiffFile[];
}

/**
 * Wyjście `git diff --name-status -z`: rekordy `STATUS\0ścieżka\0`, a przy
 * zmianie nazwy i kopiowaniu `STATUS\0stara\0nowa\0`. Format `-z` bierzemy
 * po to, żeby ścieżki ze spacjami i cudzysłowami nie wymagały odcytowywania.
 */
export function parseNameStatusZ(stdout: string): BranchDiffFile[] {
  const tokens = stdout.split('\0');
  const files: BranchDiffFile[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const status = tokens[index];
    if (!status || status.trim() === '') {
      continue;
    }
    const letter = status[0] ?? '';
    if (!/[A-Z]/.test(letter)) {
      continue;
    }
    if (letter === 'R' || letter === 'C') {
      const oldPath = tokens[index + 1] ?? '';
      const newPath = tokens[index + 2] ?? '';
      index += 2;
      if (newPath !== '') {
        files.push({ status: letter, path: newPath, oldPath });
      }
      continue;
    }
    const path = tokens[index + 1] ?? '';
    index += 1;
    if (path !== '') {
      files.push({ status: letter, path, oldPath: '' });
    }
  }
  return files;
}

const STATUS_ORDER: Record<string, number> = { A: 0, M: 1, R: 2, C: 3, T: 4, D: 5 };

/** Dodane i zmienione przed usuniętymi, dalej alfabetycznie — kolejność czytania. */
export function sortBranchDiff(files: readonly BranchDiffFile[]): BranchDiffFile[] {
  return [...files].sort((a, b) => {
    const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return byStatus === 0 ? a.path.localeCompare(b.path) : byStatus;
  });
}

/**
 * Strona „przed" dla zakładki diffa. Plik dodany na gałęzi nie istnieje
 * w bazie — wtedy zakładka ma pokazać pustą lewą stronę, a nie błąd.
 */
export function baseSideFor(file: BranchDiffFile, mergeBase: string): string | null {
  return file.status === 'A' ? null : mergeBase;
}
