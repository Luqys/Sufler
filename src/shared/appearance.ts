/**
 * Motyw aplikacji: tryb jasny/ciemny/systemowy/matrixowy + kolor przewodni
 * (akcent) + język interfejsu.
 */

export type ThemeMode = 'system' | 'light' | 'dark' | 'matrix';
export type AccentId = 'clay' | 'blue' | 'green' | 'violet' | 'pink';
export type Language = 'pl' | 'en';

export interface Appearance {
  mode: ThemeMode;
  accent: AccentId;
  language: Language;
}

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: 'pl', label: 'Polski' },
  { id: 'en', label: 'English' },
];

export const DEFAULT_APPEARANCE: Appearance = { mode: 'system', accent: 'clay', language: 'pl' };

/** Etykiety trybów i akcentów są w słowniku i18n (klucze theme.* i accent.*). */
export const THEME_MODES: Array<{ id: ThemeMode }> = [
  { id: 'system' },
  { id: 'light' },
  { id: 'dark' },
  { id: 'matrix' },
];

/** swatch — kolor próbki w ustawieniach (wariant jasny). */
export const ACCENTS: Array<{ id: AccentId; swatch: string }> = [
  { id: 'clay', swatch: '#c15f3c' },
  { id: 'blue', swatch: '#2563eb' },
  { id: 'green', swatch: '#16a34a' },
  { id: 'violet', swatch: '#7c3aed' },
  { id: 'pink', swatch: '#db2777' },
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
  const language = LANGUAGES.some((entry) => entry.id === obj['language'])
    ? (obj['language'] as Language)
    : DEFAULT_APPEARANCE.language;
  return { mode, accent, language };
}
