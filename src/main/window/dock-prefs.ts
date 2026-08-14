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
