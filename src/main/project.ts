import { dialog, type BrowserWindow } from 'electron';
import { t } from './i18n';
import { statSync } from 'node:fs';
import { readState, writeState } from './state-store';

let currentRoot: string | null = null;

function isDirectory(path: string | undefined): path is string {
  if (!path) {
    return false;
  }
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Bez auto-wznawiania: przy każdym uruchomieniu użytkownik wybiera folder
 * na ekranie startowym (ostatnie + przeglądanie). Zmienna środowiskowa
 * (testy/CLI) pomija ekran; cache trzyma wybór do końca życia procesu,
 * więc przeładowanie okna nie pyta ponownie.
 */
export function getProjectRoot(): string | null {
  if (currentRoot) {
    return currentRoot;
  }
  const fromEnv = process.env['VISUALN3O_ROOT'];
  if (isDirectory(fromEnv)) {
    currentRoot = fromEnv;
    return currentRoot;
  }
  return null;
}

function rememberRecentRoot(path: string): void {
  const state = readState();
  state.recentRoots = [path, ...(state.recentRoots ?? []).filter((entry) => entry !== path)].slice(
    0,
    8,
  );
  writeState(state);
}

export function getRecentRoots(): string[] {
  return (readState().recentRoots ?? []).filter((entry) => isDirectory(entry));
}

export function setProjectRoot(path: string): boolean {
  if (!isDirectory(path)) {
    return false;
  }
  currentRoot = path;
  rememberRecentRoot(path);
  return true;
}

export async function chooseProjectRoot(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: t('main.openProject'),
    properties: ['openDirectory', 'createDirectory'],
  });
  const picked = result.filePaths[0];
  if (result.canceled || !picked) {
    return null;
  }
  currentRoot = picked;
  rememberRecentRoot(picked);
  return picked;
}

/**
 * Wybór KATALOGU, w którym powstanie nowy projekt (M76). W odróżnieniu od
 * `chooseProjectRoot` nie zmienia folderu roboczego — sam wskazuje miejsce.
 */
export async function chooseProjectParent(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: t('main.chooseParent'),
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

/** Vault Obsidiana — źródło indeksu wikilinków (warstwa 3, M36). */
export function getVaultPath(): string | null {
  const fromEnv = process.env['VISUALN3O_VAULT'];
  if (isDirectory(fromEnv)) {
    return fromEnv;
  }
  const fromState = readState().vaultPath;
  return isDirectory(fromState) ? fromState : null;
}

export async function chooseVaultPath(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: t('main.chooseVault'),
    properties: ['openDirectory'],
  });
  const picked = result.filePaths[0];
  if (result.canceled || !picked) {
    return null;
  }
  writeState({ ...readState(), vaultPath: picked });
  return picked;
}

export function clearVaultPath(): void {
  const state = readState();
  delete state.vaultPath;
  writeState(state);
}
