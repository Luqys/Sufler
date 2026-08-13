import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { projectSlug } from '../../shared/claude/claude-sessions';
import {
  createHitScanner,
  isSearchableQuery,
  type SessionHits,
} from '../../shared/claude/transcript-search';

/**
 * Szukanie frazy w transkryptach projektu (M83). Pliki bywają
 * trzydziestomegabajtowe, więc lecimy strumieniowo, od najnowszego, i kończymy,
 * gdy uzbiera się dość sesji — panel pokazuje trop, nie wypisuje całej historii.
 */

/** Ile sesji z trafieniami zwracamy i ile trafień z każdej. */
const MAX_SESSIONS = 12;
const HITS_PER_SESSION = 3;

function claudeConfigDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude');
}

function sessionsDir(root: string): string {
  return join(claudeConfigDir(), 'projects', projectSlug(root));
}

export async function searchTranscripts(root: string, query: string): Promise<SessionHits[]> {
  if (!isSearchableQuery(query)) {
    return [];
  }
  const dir = sessionsDir(root);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  // Od najnowszej rozmowy — szukającego zwykle interesuje ostatnia wzmianka.
  const files: Array<{ id: string; path: string; mtimeMs: number }> = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) {
      continue;
    }
    const path = join(dir, name);
    try {
      const info = await stat(path);
      files.push({ id: name.replace(/\.jsonl$/, ''), path, mtimeMs: info.mtimeMs });
    } catch {
      continue;
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const found: SessionHits[] = [];
  for (const file of files) {
    if (found.length >= MAX_SESSIONS) {
      break;
    }
    const scanner = createHitScanner(query, HITS_PER_SESSION);
    try {
      const reader = createInterface({
        input: createReadStream(file.path),
        crlfDelay: Number.POSITIVE_INFINITY,
      });
      for await (const line of reader) {
        scanner.push(line);
      }
    } catch {
      continue; // plik zniknął albo jest nieczytelny — reszta ma zostać przeszukana
    }
    const { hits, more } = scanner.result();
    if (hits.length > 0) {
      found.push({ id: file.id, hits, more });
    }
  }
  return found;
}
