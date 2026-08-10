import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseUsageLine, summarizeUsage, type UsageEntry, type UsageSummary } from '../shared/usage';

const SCAN_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { at: number; summary: UsageSummary } | null = null;

async function listTranscripts(root: string, cutoff: number): Promise<string[]> {
  const files: string[] = [];
  let projectDirs: string[];
  try {
    projectDirs = await readdir(root);
  } catch {
    return files;
  }
  for (const dir of projectDirs) {
    const dirPath = join(root, dir);
    let names: string[];
    try {
      names = await readdir(dirPath);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith('.jsonl')) {
        continue;
      }
      const filePath = join(dirPath, name);
      try {
        const info = await stat(filePath);
        if (info.isFile() && info.mtimeMs >= cutoff) {
          files.push(filePath);
        }
      } catch {
        // plik mógł zniknąć w trakcie skanowania
      }
    }
  }
  return files;
}

function readEntries(filePath: string): Promise<UsageEntry[]> {
  return new Promise((resolve) => {
    const entries: UsageEntry[] = [];
    const reader = createInterface({ input: createReadStream(filePath, 'utf8') });
    reader.on('line', (line) => {
      const entry = parseUsageLine(line);
      if (entry) {
        entries.push(entry);
      }
    });
    reader.on('close', () => resolve(entries));
    reader.on('error', () => resolve(entries));
  });
}

export async function getClaudeUsage(force = false): Promise<UsageSummary> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.summary;
  }
  const files = await listTranscripts(join(homedir(), '.claude', 'projects'), now - SCAN_WINDOW_MS);
  const perFile = await Promise.all(files.map((file) => readEntries(file)));
  const summary = summarizeUsage(perFile.flat(), now, files.length);
  cache = { at: now, summary };
  return summary;
}
