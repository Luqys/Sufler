import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SearchMatch, SearchResult } from '../../shared/ipc';
import { resolveShellEnv } from '../system/shell-env';

const execFileAsync = promisify(execFile);

const MAX_RESULTS = 300;

/**
 * Parser NDJSON z `rg --json`: interesują nas wyłącznie zdarzenia `match`.
 */
export function parseRipgrepJson(stdout: string, cap = MAX_RESULTS): {
  matches: SearchMatch[];
  truncated: boolean;
} {
  const matches: SearchMatch[] = [];
  let truncated = false;
  for (const line of stdout.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const event = parsed as {
      type?: string;
      data?: {
        path?: { text?: string };
        lines?: { text?: string };
        line_number?: number;
        submatches?: Array<{ start?: number }>;
      };
    };
    if (event.type !== 'match' || !event.data) {
      continue;
    }
    const path = event.data.path?.text;
    const lineNumber = event.data.line_number;
    if (!path || typeof lineNumber !== 'number') {
      continue;
    }
    if (matches.length >= cap) {
      truncated = true;
      break;
    }
    matches.push({
      // rg z jawną ścieżką `.` zwraca `./ścieżka` — normalizujemy.
      path: path.startsWith('./') ? path.slice(2) : path,
      line: lineNumber,
      column: (event.data.submatches?.[0]?.start ?? 0) + 1,
      preview: (event.data.lines?.text ?? '').trimEnd().slice(0, 400),
    });
  }
  return { matches, truncated };
}

function rgArgs(query: string): string[] {
  return [
    '--json',
    '--smart-case',
    '--hidden',
    '-g',
    '!.git',
    '--max-count',
    '50',
    '--max-columns',
    '600',
    '--',
    query,
    // Jawna ścieżka jest konieczna: bez niej rg pod execFile czyta pusty stdin
    // (pipe) zamiast przeszukiwać katalog roboczy.
    '.',
  ];
}

interface ExecError {
  code?: number | string;
  stdout?: string;
}

async function runRg(
  command: string,
  query: string,
  root: string,
  env: Record<string, string>,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, rgArgs(query), {
      cwd: root,
      env,
      timeout: 15_000,
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'utf8',
    });
    return stdout;
  } catch (error) {
    // rg kończy z kodem 1, gdy nic nie znalazł — to nie jest błąd.
    const failed = error as ExecError;
    if (failed.code === 1 && typeof failed.stdout === 'string') {
      return failed.stdout;
    }
    throw error;
  }
}

/**
 * Szuka przez ripgrep. Kolejność: prawdziwa binarka `rg` z PATH, a gdy jej
 * brak — binarka Claude Code z ARGV0=rg w środowisku (wbudowany ripgrep;
 * ten sam mechanizm, którego używa funkcja shellowa instalowana przez
 * Claude Code — binarka reaguje na zmienną środowiskową ARGV0).
 */
export async function runProjectSearch(root: string, query: string): Promise<SearchResult> {
  const env = await resolveShellEnv();
  try {
    return { ok: true, ...parseRipgrepJson(await runRg('rg', query, root, env)) };
  } catch (error) {
    if ((error as ExecError).code !== 'ENOENT') {
      return { ok: false, error: String((error as Error).message ?? error) };
    }
  }
  try {
    const claudeEnv = { ...env, ARGV0: 'rg' };
    return { ok: true, ...parseRipgrepJson(await runRg('claude', query, root, claudeEnv)) };
  } catch (error) {
    if ((error as ExecError).code === 'ENOENT') {
      return { ok: false, error: 'Brak ripgrep — zainstaluj: brew install ripgrep.' };
    }
    return { ok: false, error: String((error as Error).message ?? error) };
  }
}
