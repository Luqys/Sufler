/** Motyw aplikacji: tryb jasny/ciemny/systemowy + kolor przewodni (akcent). */

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentId = 'clay' | 'blue' | 'green' | 'violet' | 'pink';

export interface Appearance {
  mode: ThemeMode;
  accent: AccentId;
}

export const DEFAULT_APPEARANCE: Appearance = { mode: 'system', accent: 'clay' };

export const THEME_MODES: Array<{ id: ThemeMode; label: string }> = [
  { id: 'system', label: 'Systemowy' },
  { id: 'light', label: 'Jasny' },
  { id: 'dark', label: 'Ciemny' },
];

/** swatch — kolor próbki w ustawieniach (wariant jasny). */
export const ACCENTS: Array<{ id: AccentId; label: string; swatch: string }> = [
  { id: 'clay', label: 'Glinka', swatch: '#c15f3c' },
  { id: 'blue', label: 'Błękit', swatch: '#2563eb' },
  { id: 'green', label: 'Zieleń', swatch: '#16a34a' },
  { id: 'violet', label: 'Fiolet', swatch: '#7c3aed' },
  { id: 'pink', label: 'Róż', swatch: '#db2777' },
];

export function normalizeAppearance(raw: unknown): Appearance {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_APPEARANCE };
  }
  const obj = raw as Record<string, unknown>;
  const mode = THEME_MODES.some((entry) => entry.id === obj['mode'])
    ? (obj['mode'] as ThemeMode)
    : DEFAULT_APPEARANCE.mode;
  const accent = ACCENTS.some((entry) => entry.id === obj['accent'])
    ? (obj['accent'] as AccentId)
    : DEFAULT_APPEARANCE.accent;
  return { mode, accent };
}
