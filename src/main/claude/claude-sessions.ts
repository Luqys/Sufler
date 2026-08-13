/** Zapisane sesje Claude projektu — menu „Wznów sesję" w doku i panel „Sesje". */
import { createReadStream } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  createSessionScanner,
  projectSlug,
  scanSessionLines,
  sortSessions,
  type ClaudeSessionDetails,
  type ClaudeSessionSummary,
} from '../../shared/claude/claude-sessions';

/** Tytuł i gałąź siedzą w pierwszych wpisach — czytamy początek, nie całość. */
const HEAD_BYTES = 64 * 1024;

/** Ile ostatnich wymian pokazuje rozwinięty wiersz panelu. */
const PREVIEW_MESSAGES = 6;

/** UUID sesji trafia do ścieżki pliku — bez separatorów i wyjść w górę. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function claudeConfigDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude');
}

function sessionsDir(root: string): string {
  return join(claudeConfigDir(), 'projects', projectSlug(root));
}

async function readHeadLines(filePath: string): Promise<string[]> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
    const lines = buffer.subarray(0, bytesRead).toString('utf8').split('\n');
    // Ostatnia linia może być ucięta w pół — JSON.parse i tak by ją odrzucił.
    return lines;
  } finally {
    await handle.close();
  }
}

export async function listClaudeSessions(
  root: string,
  limit?: number,
): Promise<ClaudeSessionSummary[]> {
  const dir = sessionsDir(root);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries: ClaudeSessionSummary[] = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) {
      continue;
    }
    const filePath = join(dir, name);
    try {
      const info = await stat(filePath);
      if (!info.isFile()) {
        continue;
      }
      const head = scanSessionLines(await readHeadLines(filePath));
      if (head.title === null) {
        // Sesje bez treści (świeże /clear, same wpisy meta) nie wnoszą nic do listy.
        continue;
      }
      entries.push({
        id: name.slice(0, -'.jsonl'.length),
        title: head.title,
        mtimeMs: info.mtimeMs,
        startedMs: head.startedMs,
        branch: head.branch,
        sizeBytes: info.size,
      });
    } catch {
      // Plik zniknął w trakcie — pomijamy.
    }
  }
  return sortSessions(entries, limit);
}

/**
 * Rozliczenie jednej sesji: liczniki i ostatnie wymiany. Transkrypty
 * potrafią mieć dziesiątki megabajtów, więc czytamy je strumieniem —
 * dlatego rzecz dzieje się dopiero po rozwinięciu wiersza, nie przy liście.
 */
export async function readClaudeSessionDetails(
  root: string,
  id: string,
): Promise<ClaudeSessionDetails | null> {
  if (!SESSION_ID.test(id)) {
    return null;
  }
  const filePath = join(sessionsDir(root), `${id}.jsonl`);
  const scanner = createSessionScanner(PREVIEW_MESSAGES);
  try {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of lines) {
      scanner.push(line);
    }
  } catch {
    return null;
  }
  const scan = scanner.result();
  return {
    userMessages: scan.userMessages,
    assistantMessages: scan.assistantMessages,
    toolCalls: scan.toolCalls,
    startedMs: scan.startedMs,
    endedMs: scan.endedMs,
    messages: scan.messages,
    truncated: scan.truncated,
  };
}
