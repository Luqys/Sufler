import { dialog, type BrowserWindow } from 'electron';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
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
 * Kolejność: zmienna środowiskowa (testy) → ostatnio otwarty projekt →
 * cwd (uruchomienie z terminala) → katalog domowy (uruchomienie z Findera, cwd '/').
 */
export function getProjectRoot(): string {
  if (currentRoot) {
    return currentRoot;
  }
  const fromEnv = process.env['VISUALN3O_ROOT'];
  if (isDirectory(fromEnv)) {
    currentRoot = fromEnv;
    return currentRoot;
  }
  const fromState = readState().lastProjectRoot;
  if (isDirectory(fromState)) {
    currentRoot = fromState;
    return currentRoot;
  }
  const cwd = process.cwd();
  if (cwd !== '/' && isDirectory(cwd)) {
    currentRoot = cwd;
    return currentRoot;
  }
  currentRoot = homedir();
  return currentRoot;
}

export async function chooseProjectRoot(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: 'Otwórz folder projektu',
    properties: ['openDirectory', 'createDirectory'],
  });
  const picked = result.filePaths[0];
  if (result.canceled || !picked) {
    return null;
  }
  currentRoot = picked;
  writeState({ ...readState(), lastProjectRoot: picked });
  return picked;
}

/** Warstwa 1 integracji z Obsidianem: vault jako drugi korzeń drzewa. */
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
    title: 'Wybierz vault Obsidiana',
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
