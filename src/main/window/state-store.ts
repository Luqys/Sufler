import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ObsidianRestConfig } from '../../shared/knowledge/obsidian-rest';
import { configDir } from './layout-store';

export interface AppState {
  /** Ostatnio otwierane foldery projektów (najnowszy pierwszy) — ekran startowy. */
  recentRoots?: string[];
  /** Diagnostyka po zapisie (M90) — domyślnie wyłączona. */
  diagnosticsAuto?: boolean;
  /** Ścieżka vaulta Obsidiana (indeks wikilinków). */
  vaultPath?: string;
  /** Motyw i akcent (normalizowane w shared/appearance). */
  appearance?: unknown;
  /** Local REST API — „wyślij do notatki dziennej" (M36). */
  obsidian?: ObsidianRestConfig;
  /** Dziennik sesji Claude (M52); brak wartości = włączony. */
  sessionLog?: boolean;
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
    const state: AppState = {};
    if (typeof obj['diagnosticsAuto'] === 'boolean') {
      state.diagnosticsAuto = obj['diagnosticsAuto'];
    }
    if (Array.isArray(obj['recentRoots'])) {
      state.recentRoots = obj['recentRoots'].filter(
        (entry): entry is string => typeof entry === 'string',
      );
    }
    if (typeof obj['vaultPath'] === 'string') {
      state.vaultPath = obj['vaultPath'];
    }
    if (typeof obj['appearance'] === 'object' && obj['appearance'] !== null) {
      state.appearance = obj['appearance'];
    }
    if (typeof obj['sessionLog'] === 'boolean') {
      state.sessionLog = obj['sessionLog'];
    }
    if (typeof obj['obsidian'] === 'object' && obj['obsidian'] !== null) {
      const source = obj['obsidian'] as Record<string, unknown>;
      const obsidian: ObsidianRestConfig = {};
      for (const key of ['url', 'apiKey', 'dailyFile', 'dailyHeading'] as const) {
        if (typeof source[key] === 'string') {
          obsidian[key] = source[key];
        }
      }
      state.obsidian = obsidian;
    }
    return state;
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
