/**
 * Cmd+P (M37): lista plików projektu z respektowaniem .gitignore.
 * Ten sam łańcuch co wyszukiwanie: `rg` z PATH, a bez niego binarka
 * Claude Code z ARGV0=rg (wbudowany ripgrep).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ListFilesResult } from '../../shared/ipc';
import { resolveShellEnv } from '../system/shell-env';

const execFileAsync = promisify(execFile);

const MAX_FILES = 20_000;

/** `--hidden -g !.git` jak w wyszukiwaniu; jawna ścieżka `.` (pusty stdin-pipe). */
const RG_ARGS = ['--files', '--hidden', '-g', '!.git', '.'];

function parseFileList(stdout: string): { files: string[]; truncated: boolean } {
  const files: string[] = [];
  let truncated = false;
  for (const line of stdout.split('\n')) {
    const path = line.startsWith('./') ? line.slice(2) : line;
    if (path.trim() === '') {
      continue;
    }
    if (files.length >= MAX_FILES) {
      truncated = true;
      break;
    }
    files.push(path);
  }
  return { files, truncated };
}

async function runRgFiles(
  command: string,
  root: string,
  env: Record<string, string>,
): Promise<string> {
  const { stdout } = await execFileAsync(command, RG_ARGS, {
    cwd: root,
    env,
    timeout: 15_000,
    maxBuffer: 32 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
}

export async function runListFiles(root: string): Promise<ListFilesResult> {
  const env = await resolveShellEnv();
  try {
    return { ok: true, ...parseFileList(await runRgFiles('rg', root, env)) };
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') {
      return { ok: false, error: String((error as Error).message ?? error) };
    }
  }
  try {
    const claudeEnv = { ...env, ARGV0: 'rg' };
    return { ok: true, ...parseFileList(await runRgFiles('claude', root, claudeEnv)) };
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return { ok: false, error: 'Brak ripgrep — zainstaluj: brew install ripgrep.' };
    }
    return { ok: false, error: String((error as Error).message ?? error) };
  }
}
