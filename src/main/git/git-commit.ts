import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  commitMessageProblem,
  isSafeRelativePath,
  normalizeCommitMessage,
} from '../../shared/git/git-commit';
import type { GitCommitResult } from '../../shared/ipc';

const execFileAsync = promisify(execFile);

/**
 * Zatwierdzanie zaznaczonych plików (M69). Commit jest częściowy
 * (`git commit -- <ścieżki>`), więc bierze wyłącznie to, co zaznaczono
 * w panelu — reszta indeksu użytkownika zostaje nietknięta. Autora bierzemy
 * z konfiguracji repozytorium; aplikacja nie podstawia własnego.
 */

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    timeout: 20_000,
    maxBuffer: 16 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
}

/** Komunikat gita z odrzuconego wywołania — do rozpoznania typowych awarii. */
function messageOf(error: unknown): string {
  const shell = error as { stderr?: string; stdout?: string; message?: string };
  return `${shell.stderr ?? ''}\n${shell.stdout ?? ''}\n${shell.message ?? ''}`;
}

async function isRepo(root: string): Promise<boolean> {
  try {
    await git(root, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/** Czy repozytorium ma już jakikolwiek commit (HEAD nie jest „nienarodzony"). */
async function hasHead(root: string): Promise<boolean> {
  try {
    await git(root, ['rev-parse', '--verify', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

export async function runGitCommit(
  root: string,
  paths: readonly string[],
  message: string,
): Promise<GitCommitResult> {
  if (paths.some((path) => !isSafeRelativePath(path))) {
    return { ok: false, error: 'bad-path' };
  }
  const selected = [...new Set(paths)].sort();
  if (selected.length === 0) {
    return { ok: false, error: 'nothing-selected' };
  }
  if (commitMessageProblem(message) !== null) {
    return { ok: false, error: 'empty-message' };
  }
  if (!(await isRepo(root))) {
    return { ok: false, error: 'not-a-repo' };
  }

  const normalized = normalizeCommitMessage(message);
  try {
    // `add` obejmuje też pliki nieśledzone — bez tego commit częściowy
    // odrzuciłby ścieżkę, której git jeszcze nie zna.
    await git(root, ['add', '--', ...selected]);
  } catch (error) {
    return { ok: false, error: 'commit-failed', detail: messageOf(error).trim().slice(0, 400) };
  }

  try {
    // W repozytorium bez commitów nie ma z czego zbudować indeksu
    // częściowego — tam zatwierdzamy to, co przed chwilą dodaliśmy.
    const args = (await hasHead(root))
      ? ['commit', '-m', normalized, '--', ...selected]
      : ['commit', '-m', normalized];
    await git(root, args);
  } catch (error) {
    const text = messageOf(error);
    if (/Please tell me who you are|unable to auto-detect email|empty ident name/i.test(text)) {
      return { ok: false, error: 'identity-missing' };
    }
    if (/nothing to commit|no changes added to commit/i.test(text)) {
      return { ok: false, error: 'nothing-to-commit' };
    }
    return { ok: false, error: 'commit-failed', detail: text.trim().slice(0, 400) };
  }

  let shortHash: string;
  try {
    shortHash = (await git(root, ['rev-parse', '--short', 'HEAD'])).trim();
  } catch {
    shortHash = '';
  }
  return { ok: true, shortHash, files: selected.length };
}
