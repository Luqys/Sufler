/**
 * Twarde limity dla dużych repozytoriów (M88). Progi nie są przeczuciem —
 * pochodzą z pomiaru na wygenerowanym repozytorium (25 000 plików, katalog
 * z 20 000 wpisów):
 *
 * - `git check-ignore` (robione przy KAŻDYM rozwinięciu katalogu):
 *   200 ścieżek → 24 ms, 1000 → 48 ms, 2000 → 87 ms, 5000 → 220 ms,
 *   20 000 → 810 ms. Rośnie liniowo i to on decyduje o odczuciu płynności.
 * - `readdir` 20 000 wpisów → 26 ms, `rg --files` 25 000 plików → 64 ms,
 *   `git status --porcelain` → 30 ms. Te ścieżki są niewinne.
 * - chokidar: 250 katalogów → 257 ms; jeden katalog z 20 000 wpisów → 749 ms.
 *
 * Stąd: 2000 wpisów na katalog (87 ms — poniżej progu zauważalności) i 200
 * obserwowanych katalogów naraz.
 */

/** Ile wpisów katalogu pokazujemy, zanim dołożymy notkę „+N więcej". */
export const TREE_ENTRY_LIMIT = 2000;

/** Ile katalogów obserwujemy jednocześnie (najświeżej rozwinięte wygrywają). */
export const WATCH_DIR_LIMIT = 200;

export interface Capped<T> {
  items: T[];
  /** Ile wpisów przycięto; 0 = pokazujemy wszystko. */
  hidden: number;
}

/**
 * Przycięcie listy wpisów katalogu. Ucinamy PRZED zapytaniem gita o ignorowane
 * ścieżki — w tym tkwi cały zysk, bo to `check-ignore` rośnie z liczbą wpisów,
 * a nie sam odczyt katalogu.
 */
export function capEntries<T>(items: readonly T[], limit = TREE_ENTRY_LIMIT): Capped<T> {
  return items.length <= limit
    ? { items: [...items], hidden: 0 }
    : { items: items.slice(0, limit), hidden: items.length - limit };
}

/**
 * Katalogi do obserwacji: zostawiamy OSTATNIE `limit`, bo lista przychodzi
 * w kolejności rozwijania, a najświeżej otwarty katalog jest tym, na którym
 * człowiek właśnie pracuje. Duplikaty znoszone.
 */
export function capWatchDirs(dirs: readonly string[], limit = WATCH_DIR_LIMIT): string[] {
  const unique = [...new Set(dirs)];
  return unique.length <= limit ? unique : unique.slice(unique.length - limit);
}
