/**
 * Indeks notatek vaulta: nazwa → ścieżka, pod wikilinki [[Notatka]] w Monaco
 * (M36). Wysyłka zaznaczenia do notatki dziennej Obsidiana odpadła w M98 —
 * właściciel projektu nigdy jej nie używał, a ciągnęła za sobą konfigurację
 * pluginu Local REST API w Ustawieniach.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { noteIndexKey } from '../../shared/knowledge/wikilinks';
import { getVaultPath } from '../project/project';

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
