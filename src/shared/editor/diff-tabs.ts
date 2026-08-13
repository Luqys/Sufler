/**
 * Zakładki diffów w edytorze: pseudo-ścieżki `vn3o://diff/...` i tytuły.
 * Prefiks `vn3o://` jest wspólny z podglądem/grafem, więc istniejące filtry
 * (obserwator plików, bufory) traktują diffy jak pozostałe pseudo-zakładki.
 */

export type DiffDescriptor =
  /** Zmiany robocze pliku względem HEAD (ścieżka względem korzenia projektu). */
  | { kind: 'worktree'; path: string }
  /** Zmiana pliku w konkretnym commicie względem pierwszego rodzica. */
  | { kind: 'commit'; hash: string; parent: string | null; path: string; status: string }
  /** Propozycja z sesji Claude (narzędzie openDiff serwera ide). */
  | { kind: 'ide'; requestId: number; oldPath: string; newPath: string; tabName: string };

export const DIFF_PATH_PREFIX = 'vn3o://diff/';

export function diffTabPath(descriptor: DiffDescriptor): string {
  return DIFF_PATH_PREFIX + encodeURIComponent(JSON.stringify(descriptor));
}

export function isDiffPath(path: string): boolean {
  return path.startsWith(DIFF_PATH_PREFIX);
}

export function parseDiffPath(path: string): DiffDescriptor | null {
  if (!isDiffPath(path)) {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(path.slice(DIFF_PATH_PREFIX.length)));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      ['worktree', 'commit', 'ide'].includes((parsed as { kind?: unknown }).kind as string)
    ) {
      return parsed as DiffDescriptor;
    }
    return null;
  } catch {
    return null;
  }
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Tytuł zakładki; etykiety przychodzą z i18n wołającego (shared nie zna języka). */
export function diffTabTitle(
  descriptor: DiffDescriptor,
  labels: { worktreeSuffix: string; ideDefault: string },
): string {
  switch (descriptor.kind) {
    case 'worktree':
      return `${basename(descriptor.path)} • ${labels.worktreeSuffix}`;
    case 'commit':
      return `${basename(descriptor.path)} @ ${descriptor.hash.slice(0, 7)}`;
    case 'ide':
      return descriptor.tabName || labels.ideDefault;
  }
}
