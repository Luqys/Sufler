import { nativeTheme } from 'electron';
import { normalizeAppearance, type Appearance } from '../shared/appearance';
import { readState, writeState } from './state-store';

/**
 * Tryb motywu idzie przez nativeTheme.themeSource — prefers-color-scheme
 * w rendererze (CSS, Monaco, xterm, vibrancy) podąża za nim automatycznie.
 */

export function getAppearance(): Appearance {
  return normalizeAppearance(readState().appearance);
}

export function applyAppearanceAtBoot(): void {
  nativeTheme.themeSource = getAppearance().mode;
}

export function setAppearance(raw: unknown): Appearance {
  const appearance = normalizeAppearance(raw);
  nativeTheme.themeSource = appearance.mode;
  writeState({ ...readState(), appearance });
  return appearance;
}
