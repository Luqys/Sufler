import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defaultLayout, normalizeLayout, type LayoutState } from '../shared/layout';

export function configDir(): string {
  const base = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
  return join(base, 'visualn3o');
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
