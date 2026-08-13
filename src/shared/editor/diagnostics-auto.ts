/**
 * Diagnostyka po zapisie (M90). Pasek z M71 uruchamia `tsc` i `eslint` na
 * żądanie; przy pracy z Claude zapis pliku to najczęstszy moment, w którym
 * chce się wiedzieć, czy projekt nadal się kompiluje — ale sprawdzanie po
 * KAŻDYM `Cmd+S` byłoby gorsze niż brak sprawdzania: `tsc` na tym repo trwa
 * kilkanaście sekund, a zapisy idą seriami.
 *
 * Czysta logika: dławik (kiedy wolno ruszyć) i filtr listy problemów.
 */

import type { Diagnostic, DiagnosticSeverity } from './diagnostics';

/** Odstęp między automatycznymi przebiegami — seria zapisów daje jeden. */
export const AUTO_MIN_GAP_MS = 5_000;

/** Zwłoka po zapisie: tyle czekamy na kolejne zapisy z tej samej serii. */
export const AUTO_DEBOUNCE_MS = 1_200;

export interface AutoRunState {
  /** Kiedy skończył się ostatni przebieg; 0 = jeszcze żadnego nie było. */
  lastFinishedMs: number;
  /** Czy przebieg trwa teraz. */
  running: boolean;
}

/**
 * Ile milisekund odczekać przed automatycznym przebiegiem po zapisie.
 * `null` znaczy „nie uruchamiaj": tryb wyłączony albo przebieg już trwa —
 * w obu wypadkach kolejka nie ma sensu, bo wynik i tak będzie świeży.
 */
export function autoRunDelay(
  state: AutoRunState,
  enabled: boolean,
  nowMs: number,
  debounceMs = AUTO_DEBOUNCE_MS,
  minGapMs = AUTO_MIN_GAP_MS,
): number | null {
  if (!enabled || state.running) {
    return null;
  }
  const sinceLast = state.lastFinishedMs === 0 ? Number.POSITIVE_INFINITY : nowMs - state.lastFinishedMs;
  // Zapis tuż po poprzednim przebiegu czeka do końca okna odstępu.
  return sinceLast >= minGapMs ? debounceMs : Math.max(debounceMs, minGapMs - sinceLast);
}

/** Bez ogonków i wielkości liter — filtr ma działać po polsku i po angielsku. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase();
}

/**
 * Filtr listy problemów: fraza po ścieżce, treści i kodzie, plus opcjonalne
 * zawężenie do samych błędów. Przy kilkudziesięciu ostrzeżeniach z `eslint`
 * to jedyny sposób, żeby dojść do trzech błędów `tsc`.
 */
export function filterDiagnostics(
  items: readonly Diagnostic[],
  query: string,
  severity: DiagnosticSeverity | 'all' = 'all',
): Diagnostic[] {
  const needle = normalize(query.trim());
  return items.filter((item) => {
    if (severity !== 'all' && item.severity !== severity) {
      return false;
    }
    if (needle === '') {
      return true;
    }
    return normalize(`${item.file} ${item.message} ${item.code}`).includes(needle);
  });
}
