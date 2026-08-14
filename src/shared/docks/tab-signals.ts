/**
 * Ogłoszenia stanu kart Claude (M100): kiedy zagrać dźwięk i pokazać
 * powiadomienie. Czysta logika — decyzja zależy wyłącznie od przejścia
 * statusu, więc daje się przetestować bez okna i bez dźwięku.
 */
import type { TabStatus } from './dock-tabs';

export type TabSignal = 'done' | 'attention' | 'error';

export interface NotifyPrefs {
  /** Dźwięk przy zmianie stanu karty. */
  sounds: boolean;
  /** Powiadomienie systemowe, gdy okno jest w tle. */
  system: boolean;
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = { sounds: true, system: true };

export function normalizeNotifyPrefs(raw: unknown): NotifyPrefs {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_NOTIFY_PREFS;
  }
  const obj = raw as Record<string, unknown>;
  return {
    sounds: typeof obj['sounds'] === 'boolean' ? obj['sounds'] : DEFAULT_NOTIFY_PREFS.sounds,
    system: typeof obj['system'] === 'boolean' ? obj['system'] : DEFAULT_NOTIFY_PREFS.system,
  };
}

/**
 * Sygnał dla przejścia statusu karty; null = nic nie ogłaszamy.
 *
 * Ogłaszamy tylko zmiany, nie stany: karta bezczynna po odebraniu odpowiedzi
 * siedzi w `idle` godzinami i bez tego warunku odzywałaby się przy każdym
 * chunku wyjścia. „Skończone" liczy się wyłącznie po pracy albo po pytaniu —
 * świeżo otwarta sesja od razu wchodzi w `idle` i nie ma czego ogłaszać.
 */
export function signalForTransition(
  previous: TabStatus | undefined,
  next: TabStatus,
  failed: boolean,
): TabSignal | null {
  if (previous === undefined || previous === next) {
    return null;
  }
  if (next === 'exited') {
    return failed ? 'error' : null;
  }
  if (next === 'needs-input') {
    return 'attention';
  }
  if (next === 'idle' && (previous === 'running' || previous === 'needs-input')) {
    return 'done';
  }
  return null;
}

/** Ten sam sygnał na tej samej karcie nie częściej niż raz na tyle. */
export const SIGNAL_THROTTLE_MS = 5_000;

/**
 * Dławik powtórek: heurystyka strumienia pty (sesje bez hooków) potrafi
 * mrugać running↔idle po kilka razy na sekundę, a każde mrugnięcie to
 * przejście statusu — bez tego dźwięk zamieniłby się w terkot.
 */
export function shouldAnnounce(
  last: { signal: TabSignal; at: number } | undefined,
  signal: TabSignal,
  now: number,
): boolean {
  return !last || last.signal !== signal || now - last.at >= SIGNAL_THROTTLE_MS;
}
