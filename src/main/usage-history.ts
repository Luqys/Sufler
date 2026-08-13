import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { projectSlug } from '../shared/claude-sessions';
import { createUsageScanner, type UsageScan } from '../shared/usage-history';

/**
 * Historia zużycia z transkryptów projektu (M73). Pliki bywają
 * trzydziestomegabajtowe, więc lecimy po nich strumieniowo i tylko wtedy,
 * gdy panel o to poprosi — bez pollingu i bez trzymania niczego w pamięci
 * poza sumami.
 */

function claudeConfigDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude');
}

export function transcriptsDir(root: string): string {
  return join(claudeConfigDir(), 'projects', projectSlug(root));
}

export async function readUsageHistory(root: string): Promise<UsageScan> {
  const scanner = createUsageScanner();
  const dir = transcriptsDir(root);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    // Projekt bez ani jednej sesji — puste sumy są poprawną odpowiedzią.
    return scanner.result();
  }
  for (const name of names) {
    if (!name.endsWith('.jsonl')) {
      continue;
    }
    try {
      const reader = createInterface({
        input: createReadStream(join(dir, name)),
        crlfDelay: Number.POSITIVE_INFINITY,
      });
      for await (const line of reader) {
        scanner.push(line);
      }
    } catch {
      // Plik zniknął albo jest nieczytelny — reszta historii ma zostać policzona.
      continue;
    }
  }
  return scanner.result();
}
