import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  SUMMARY_PROMPT,
  stripForSummary,
  withSummary,
  worthSummarizing,
} from '../shared/session-summary';
import { SESSION_LOG_DIR } from '../shared/session-log';
import { resolveShellEnv } from './shell-env';

const execFileAsync = promisify(execFile);

/**
 * Streszczenie dziennika przez `claude -p` (M54). Wywołanie zużywa limit
 * planu, więc dzieje się wyłącznie na żądanie użytkownika.
 */

export type SummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: 'not-a-log' | 'too-short' | 'claude-failed' | 'write-failed' };

/** Hak testowy: zamiast wołać `claude`, zwróć tę treść. */
function summaryOverride(): string | null {
  return process.env['VISUALN3O_SUMMARY_TEXT'] ?? null;
}

async function runClaude(root: string, prompt: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('claude', ['-p', prompt], {
      cwd: root,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8',
      env: { ...process.env, ...(await resolveShellEnv()) },
    });
    const text = stdout.trim();
    return text === '' ? null : text;
  } catch {
    return null;
  }
}

export async function summarizeSessionLog(
  root: string,
  relativePath: string,
  now = new Date(),
): Promise<SummaryResult> {
  const absolute = resolve(join(root, relativePath));
  if (!absolute.startsWith(`${resolve(root)}/`) || !absolute.includes(SESSION_LOG_DIR)) {
    return { ok: false, error: 'not-a-log' };
  }
  let markdown: string;
  try {
    markdown = await readFile(absolute, 'utf8');
  } catch {
    return { ok: false, error: 'not-a-log' };
  }
  if (!worthSummarizing(markdown)) {
    return { ok: false, error: 'too-short' };
  }
  const summary =
    summaryOverride() ?? (await runClaude(root, `${SUMMARY_PROMPT}${stripForSummary(markdown)}`));
  if (!summary) {
    return { ok: false, error: 'claude-failed' };
  }
  try {
    const time = now.toISOString().slice(0, 16).replace('T', ' ');
    await writeFile(absolute, withSummary(markdown, summary, time), 'utf8');
    return { ok: true, summary };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}
