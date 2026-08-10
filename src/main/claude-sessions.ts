/** Lista zapisanych sesji Claude projektu — do menu „Wznów sesję" w doku. */
import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  projectSlug,
  sessionTitleFromLines,
  sortSessions,
  type ClaudeSessionEntry,
} from '../shared/claude-sessions';

/** Tytuł siedzi w pierwszych wpisach — czytamy początek pliku, nie całość. */
const HEAD_BYTES = 64 * 1024;

function claudeConfigDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude');
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

export async function listClaudeSessions(root: string): Promise<ClaudeSessionEntry[]> {
  const dir = join(claudeConfigDir(), 'projects', projectSlug(root));
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries: ClaudeSessionEntry[] = [];
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
      const title = sessionTitleFromLines(await readHeadLines(filePath));
      if (title === null) {
        // Sesje bez treści (świeże /clear, same wpisy meta) nie wnoszą nic do menu.
        continue;
      }
      entries.push({ id: name.slice(0, -'.jsonl'.length), title, mtimeMs: info.mtimeMs });
    } catch {
      // Plik zniknął w trakcie — pomijamy.
    }
  }
  return sortSessions(entries);
}
