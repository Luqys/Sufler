/**
 * Worktree'y gita (M72): kilka sesji Claude nad jednym zadaniem, każda
 * w osobnym katalogu roboczym, bez przełączania gałęzi pod palcami.
 *
 * Aplikacja robi `git worktree add` sama, zamiast używać `claude --worktree`:
 * wtedy katalog wybiera CLI, a drzewo plików i panel Git nie wiedzą o nowym
 * korzeniu. Czysta logika: parser listy, walidacja nazw, nazwy gałęzi.
 */

export interface Worktree {
  /** Ścieżka absolutna katalogu roboczego. */
  path: string;
  /** Gałąź bez `refs/heads/`; pusty string dla odłączonego HEAD. */
  branch: string;
  head: string;
  /** true dla katalogu głównego repozytorium (pierwszy wpis listy). */
  main: boolean;
  /** Worktree zablokowany przez gita (`git worktree lock`). */
  locked: boolean;
}

/**
 * Wyjście `git worktree list --porcelain`: bloki rozdzielone pustą linią,
 * w każdym `worktree <ścieżka>`, `HEAD <sha>`, `branch refs/heads/<nazwa>`
 * albo `detached`, opcjonalnie `locked`.
 */
export function parseWorktreeList(stdout: string): Worktree[] {
  const worktrees: Worktree[] = [];
  let current: Worktree | null = null;
  const flush = (): void => {
    if (current !== null) {
      worktrees.push(current);
      current = null;
    }
  };
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (line.startsWith('worktree ')) {
      flush();
      current = {
        path: line.slice('worktree '.length),
        branch: '',
        head: '',
        main: worktrees.length === 0,
        locked: false,
      };
      continue;
    }
    if (current === null) {
      continue;
    }
    if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    } else if (line === 'locked' || line.startsWith('locked ')) {
      current.locked = true;
    }
  }
  flush();
  return worktrees;
}

export type WorktreeNameError = 'empty' | 'invalid' | 'too-long';

/**
 * Nazwa worktree'a jest jednocześnie nazwą gałęzi i katalogu, więc znaki
 * muszą przejść przez `git check-ref-format` i przez system plików.
 */
export function validateWorktreeName(name: string): WorktreeNameError | null {
  const trimmed = name.trim();
  if (trimmed === '') {
    return 'empty';
  }
  if (trimmed.length > 64) {
    return 'too-long';
  }
  if (trimmed.startsWith('-') || trimmed.endsWith('.') || trimmed.endsWith('.lock')) {
    return 'invalid';
  }
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(trimmed) && !trimmed.includes('..')
    ? null
    : 'invalid';
}

/**
 * Katalog nowego worktree'a: obok korzenia projektu, w `<korzeń>-worktrees`.
 * Trzymanie go POZA drzewem projektu jest celowe — inaczej chokidar, drzewo
 * plików i `rg` widziałyby kopię całego repozytorium w środku repozytorium.
 */
export function worktreePathFor(root: string, name: string): string {
  const clean = root.replace(/\/+$/, '');
  const flat = name.trim().replace(/\//g, '-');
  return `${clean}-worktrees/${flat}`;
}

/** Nazwa do pokazania: ostatni element ścieżki, a przy głównym — „projekt". */
export function worktreeLabel(worktree: Worktree): string {
  if (worktree.branch !== '') {
    return worktree.branch;
  }
  const parts = worktree.path.split('/').filter((part) => part !== '');
  return parts[parts.length - 1] ?? worktree.path;
}
