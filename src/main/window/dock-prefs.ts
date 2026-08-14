import {
  normalizeNotifyPrefs,
  type NotifyPrefs,
} from '../../shared/docks/tab-signals';
import { readState, writeState } from './state-store';

/**
 * Ustawienia doków trwałe między uruchomieniami (M99). Na razie jedno:
 * czy pytać przed zamknięciem karty z żywym procesem. Domyślnie pytamy —
 * brak wpisu w state.json ma znaczyć „tak", bo utrata sesji Claude przez
 * przypadkowy klik boli bardziej niż jedno kliknięcie za dużo.
 */
export function isConfirmCloseTab(): boolean {
  return readState().confirmCloseTab !== false;
}

export function setConfirmCloseTab(enabled: boolean): boolean {
  writeState({ ...readState(), confirmCloseTab: enabled });
  return enabled;
}

/** Dźwięki i powiadomienia o stanie kart Claude (M100). */
export function getNotifyPrefs(): NotifyPrefs {
  return normalizeNotifyPrefs(readState().notify);
}

export function setNotifyPrefs(prefs: NotifyPrefs): NotifyPrefs {
  const cleaned = normalizeNotifyPrefs(prefs);
  writeState({ ...readState(), notify: cleaned });
  return cleaned;
}
