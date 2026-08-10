import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defaultLayout, normalizeLayout, type LayoutState } from '../shared/layout';

function configBase(): string {
  return process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
}

export function configDir(): string {
  return join(configBase(), 'sufler');
}

/**
 * Jednorazowa migracja po zmianach nazwy aplikacji:
 * ~/.config/neodesk (M25) albo ~/.config/visualn3o (do M24) → sufler.
 * Nowsza nazwa ma pierwszeństwo, przenosimy pierwszy istniejący katalog.
 */
export function migrateLegacyConfigDir(): void {
  for (const name of ['neodesk', 'visualn3o']) {
    const legacy = join(configBase(), name);
    if (existsSync(legacy) && !existsSync(configDir())) {
      try {
        renameSync(legacy, configDir());
        return;
      } catch {
        // Nie udało się przenieść — próbujemy starszego katalogu albo startujemy z domyślną.
      }
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
