import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configDir } from './layout-store';

export interface AppState {
  lastProjectRoot?: string;
}

function stateFilePath(): string {
  return join(configDir(), 'state.json');
}

export function readState(): AppState {
  try {
    const raw: unknown = JSON.parse(readFileSync(stateFilePath(), 'utf8'));
    if (typeof raw !== 'object' || raw === null) {
      return {};
    }
    const obj = raw as Record<string, unknown>;
    return typeof obj['lastProjectRoot'] === 'string'
      ? { lastProjectRoot: obj['lastProjectRoot'] }
      : {};
  } catch {
    return {};
  }
}

export function writeState(state: AppState): void {
  mkdirSync(configDir(), { recursive: true });
  const file = stateFilePath();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}
