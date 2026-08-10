import { nativeTheme } from 'electron';
import { normalizeAppearance, type Appearance } from '../shared/appearance';
import { readState, writeState } from './state-store';

/**
 * Tryb motywu idzie przez nativeTheme.themeSource — prefers-color-scheme
 * w rendererze (CSS, Monaco, xterm, vibrancy) podąża za nim automatycznie.
 * Tryb 'matrix' to wariant ciemnego: paletę nakłada renderer (data-flavor).
 */

function themeSourceFor(appearance: Appearance): 'system' | 'light' | 'dark' {
  return appearance.mode === 'matrix' ? 'dark' : appearance.mode;
}

export function getAppearance(): Appearance {
  return normalizeAppearance(readState().appearance);
}

export function applyAppearanceAtBoot(): void {
  nativeTheme.themeSource = themeSourceFor(getAppearance());
}

export function setAppearance(raw: unknown): Appearance {
  const appearance = normalizeAppearance(raw);
  nativeTheme.themeSource = themeSourceFor(appearance);
  writeState({ ...readState(), appearance });
  return appearance;
}
