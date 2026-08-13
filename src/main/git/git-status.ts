import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitFileState = 'modified' | 'untracked';

export interface GitStatusEntry {
  /** Ścieżka względem korzenia repo; katalogi bez końcowego ukośnika. */
  path: string;
  state: GitFileState;
}

/**
 * Format `git status --porcelain -z`: wpisy `XY ścieżka\0`, bez cytowania.
 * Rename/copy (X = R/C) ma DRUGI token ze starą ścieżką — do pominięcia.
 */
export function parseGitStatusPorcelainZ(output: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = [];
  const tokens = output.split('\0');
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || token.length < 4) {
      continue;
    }
    const x = token[0] ?? ' ';
    const y = token[1] ?? ' ';
    let path = token.slice(3);
    if (x === 'R' || x === 'C') {
      i++; // stara ścieżka
    }
    if (x === '!' || y === '!') {
      continue;
    }
    if (y === 'D' || (x === 'D' && y === ' ')) {
      continue; // usunięte — nie ma czego kolorować w drzewie
    }
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    entries.push({ path, state: x === '?' ? 'untracked' : 'modified' });
  }
  return entries;
}

export async function runGitStatus(root: string): Promise<GitStatusEntry[]> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', '-z'], {
      cwd: root,
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return parseGitStatusPorcelainZ(stdout);
  } catch {
    return []; // poza repozytorium git — brak kolorowania
  }
}
