/**
 * Warstwa 3 integracji z Obsidianem (M36): indeks nazwa→ścieżka dla
 * wikilinków, deep link `obsidian://open` i PATCH do notatki dziennej
 * przez plugin Local REST API.
 */
import { shell } from 'electron';
import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import type { SendToNoteResult } from '../shared/ipc';
import { buildAppendRequest, type ObsidianRestConfig } from '../shared/obsidian-rest';
import { noteIndexKey } from '../shared/wikilinks';
import { getVaultPath } from './project';
import { readState, writeState } from './state-store';

const INDEX_TTL_MS = 5_000;
const SKIP_DIRS = new Set(['.obsidian', '.trash', 'node_modules', '.git']);

let cachedIndex: Map<string, string> | null = null;
let cachedAt = 0;
let cachedVault: string | null = null;

function buildIndex(vault: string): Map<string, string> {
  const index = new Map<string, string>();
  const walk = (dir: string, depth: number): void => {
    if (depth > 12) {
      return;
    }
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) {
        continue;
      }
      const full = join(dir, name);
      try {
        const info = statSync(full);
        if (info.isDirectory()) {
          walk(full, depth + 1);
        } else if (name.endsWith('.md')) {
          const key = noteIndexKey(name);
          // Pierwsze trafienie wygrywa — jak przy rozwiązywaniu w Obsidianie.
          if (!index.has(key)) {
            index.set(key, full);
          }
        }
      } catch {
        // wpis zniknął w trakcie
      }
    }
  };
  walk(vault, 0);
  return index;
}

function noteIndex(): Map<string, string> {
  const vault = getVaultPath();
  if (!vault) {
    return new Map();
  }
  const now = Date.now();
  if (cachedIndex && cachedVault === vault && now - cachedAt < INDEX_TTL_MS) {
    return cachedIndex;
  }
  cachedIndex = buildIndex(vault);
  cachedVault = vault;
  cachedAt = now;
  return cachedIndex;
}

/** Rozwiązanie nazw wikilinków na ścieżki absolutne (null = brak notatki). */
export function resolveNoteLinks(names: string[]): Record<string, string | null> {
  const index = noteIndex();
  const result: Record<string, string | null> = {};
  for (const name of names) {
    result[name] = index.get(noteIndexKey(name)) ?? null;
  }
  return result;
}

/** Cmd+klik na notatce vaulta w drzewie → otwarcie w prawdziwym Obsidianie. */
export function openNoteInObsidian(absPath: string): boolean {
  const vault = getVaultPath();
  if (!vault || !absPath.startsWith(`${vault}/`)) {
    return false;
  }
  const url =
    `obsidian://open?vault=${encodeURIComponent(basename(vault))}` +
    `&file=${encodeURIComponent(relative(vault, absPath).replace(/\.md$/, ''))}`;
  void shell.openExternal(url);
  return true;
}

export function getObsidianConfig(): ObsidianRestConfig {
  return readState().obsidian ?? {};
}

export function setObsidianConfig(config: ObsidianRestConfig): ObsidianRestConfig {
  const cleaned: ObsidianRestConfig = {};
  for (const key of ['url', 'apiKey', 'dailyFile', 'dailyHeading'] as const) {
    const value = config[key];
    if (typeof value === 'string' && value.trim() !== '') {
      cleaned[key] = value.trim();
    }
  }
  writeState({ ...readState(), obsidian: cleaned });
  return cleaned;
}

/** Dopisanie treści pod nagłówek notatki dziennej (Operation: append). */
export async function sendToDailyNote(content: string): Promise<SendToNoteResult> {
  const request = buildAppendRequest(getObsidianConfig(), content, new Date());
  if (!request) {
    return { ok: false, error: 'not-configured' };
  }
  try {
    const response = await fetch(request.url, {
      method: 'PATCH',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok ? { ok: true } : { ok: false, error: 'rejected' };
  } catch {
    // Serwer żyje tylko przy otwartym Obsidianie — to normalny przypadek.
    return { ok: false, error: 'unreachable' };
  }
}
