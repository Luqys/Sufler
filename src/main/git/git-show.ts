/** Treść pliku z rewizji gita — oryginał/strona commita w zakładkach diffów. */
import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import type { GitShowFileResult } from '../../shared/ipc';

const execFileAsync = promisify(execFile);

const REV_PATTERN = /^(HEAD|[0-9a-f]{4,40})$/;
const MAX_BYTES = 10 * 1024 * 1024;

export async function runGitShowFile(
  root: string,
  rev: string,
  relPath: string,
): Promise<GitShowFileResult> {
  if (!REV_PATTERN.test(rev) || isAbsolute(relPath) || relPath.split('/').includes('..')) {
    return { ok: false, error: 'failed' };
  }
  try {
    const { stdout } = await execFileAsync('git', ['show', `${rev}:${relPath}`], {
      cwd: root,
      maxBuffer: MAX_BYTES,
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (stdout.includes('\0')) {
      return { ok: false, error: 'binary' };
    }
    return { ok: true, content: stdout };
  } catch (error) {
    const message = String((error as { stderr?: string }).stderr ?? (error as Error).message);
    if (
      message.includes('does not exist') ||
      message.includes('exists on disk, but not in') ||
      message.includes('bad revision')
    ) {
      return { ok: false, error: 'absent' };
    }
    return { ok: false, error: 'failed' };
  }
}
