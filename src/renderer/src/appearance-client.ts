import type { AccentId, Appearance, ThemeMode } from '../../shared/appearance';
import { setLanguage } from './i18n';

/** Kolor przewodni przez atrybut na <html>; tryb jasny/ciemny załatwia nativeTheme. */
export function applyAccent(accent: AccentId): void {
  document.documentElement.dataset['accent'] = accent;
}

/** Zdarzenie dla modułów poza Reactem (xterm, Monaco) — zmiana smaku motywu. */
export const FLAVOR_EVENT = 'neodesk:flavor';

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
  applyThemeFlavor(appearance.mode);
  setLanguage(appearance.language);
}
