import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defaultLayout, normalizeLayout, type LayoutState } from '../shared/layout';

function configBase(): string {
  return process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
}

export function configDir(): string {
  return join(configBase(), 'neodesk');
}

/** Jednorazowa migracja po zmianie nazwy aplikacji: ~/.config/visualn3o → neodesk. */
export function migrateLegacyConfigDir(): void {
  const legacy = join(configBase(), 'visualn3o');
  if (existsSync(legacy) && !existsSync(configDir())) {
    try {
      renameSync(legacy, configDir());
    } catch {
      // Nie udało się przenieść — start z domyślną konfiguracją.
    }
  }
}

export function layoutFilePath(): string {
  return join(configDir(), 'layout.json');
}

export function readLayout(): LayoutState {
  try {
    return normalizeLayout(JSON.parse(readFileSync(layoutFilePath(), 'utf8')));
  } catch {
    return defaultLayout();
  }
}

export function writeLayout(raw: unknown): void {
  const state = normalizeLayout(raw);
  mkdirSync(configDir(), { recursive: true });
  const file = layoutFilePath();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}
