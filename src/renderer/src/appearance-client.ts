import type { AccentId, Appearance, ThemeMode } from '../../shared/appearance';
import { setLanguage } from './i18n';

/** Zapytanie o ciemny motyw systemu — źródło prawdy dla trybu „Systemowy". */
const darkQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

let currentMode: ThemeMode = 'system';
let systemWatch = false;

/**
 * Jawny atrybut motywu na <html> (M58). Wcześniej tryb jasny/ciemny wisiał
 * wyłącznie na prefers-color-scheme sterowanym przez nativeTheme — gdy ten
 * sygnał nie docierał do okna, wybór użytkownika nie dawał efektu i zapisany
 * ciemny motyw wracał jasny po restarcie.
 */
export function applyThemeMode(mode: ThemeMode): void {
  const dark = mode === 'dark' || mode === 'matrix' || (mode === 'system' && !!darkQuery?.matches);
  document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
}

/** Kolor przewodni przez atrybut na <html>. */
export function applyAccent(accent: AccentId): void {
  document.documentElement.dataset['accent'] = accent;
}

/** Zdarzenie dla modułów poza Reactem (xterm, Monaco) — zmiana smaku motywu. */
export const FLAVOR_EVENT = 'sufler:flavor';

/**
 * Smak motywu: 'matrix' nakłada zieloną paletę przez atrybut na <html>.
 * nativeTheme widzi wtedy zwykły tryb ciemny (patrz main/appearance).
 */
export function applyThemeFlavor(mode: ThemeMode): void {
  if (mode === 'matrix') {
    document.documentElement.dataset['flavor'] = 'matrix';
  } else {
    delete document.documentElement.dataset['flavor'];
  }
  window.dispatchEvent(new CustomEvent(FLAVOR_EVENT));
}

export function isMatrixFlavor(): boolean {
  return document.documentElement.dataset['flavor'] === 'matrix';
}

export function applyAppearance(appearance: Appearance): void {
  applyAccent(appearance.accent);
  applyThemeMode(appearance.mode);
  applyThemeFlavor(appearance.mode);
  setLanguage(appearance.language);
  currentMode = appearance.mode;
  // Tryb „Systemowy" podąża za zmianą motywu systemu w locie.
  if (darkQuery && !systemWatch) {
    systemWatch = true;
    darkQuery.addEventListener('change', () => {
      if (currentMode === 'system') {
        applyThemeMode('system');
        window.dispatchEvent(new CustomEvent(FLAVOR_EVENT));
      }
    });
  }
}
