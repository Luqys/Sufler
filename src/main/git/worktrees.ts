import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  parseWorktreeList,
  validateWorktreeName,
  worktreePathFor,
  type Worktree,
} from '../../shared/git/worktrees';
import type { WorktreeMergeResult, WorktreeWriteResult } from '../../shared/ipc';

const execFileAsync = promisify(execFile);

/**
 * Operacje na worktree'ach (M72). Aplikacja nigdy nie rozwiązuje konfliktów
 * ani nie kasuje cudzej pracy: scalanie idzie `--no-ff` i przy konflikcie
 * kończy się komunikatem, a usunięcie worktree'a wymaga jawnej zgody
 * i domyślnie nie wchodzi (`git worktree remove` bez `--force`).
 */

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
}

function messageOf(error: unknown): string {
  const shell = error as { stderr?: string; stdout?: string; message?: string };
  return `${shell.stderr ?? ''}\n${shell.stdout ?? ''}\n${shell.message ?? ''}`.trim();
}

export async function listWorktrees(root: string): Promise<Worktree[]> {
  try {
    return parseWorktreeList(await git(root, ['worktree', 'list', '--porcelain']));
  } catch {
    return []; // poza repozytorium git — panel pokaże pustkę, nie błąd
  }
}

/** Gałąź bieżąca projektu — baza dla nowego worktree'a i cel scalania. */
export async function currentBranch(root: string): Promise<string> {
  try {
    return (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  } catch {
    return '';
  }
}

export async function addWorktree(root: string, name: string): Promise<WorktreeWriteResult> {
  if (validateWorktreeName(name) !== null) {
    return { ok: false, error: 'invalid-name' };
  }
  const trimmed = name.trim();
  const path = worktreePathFor(root, trimmed);
  try {
    // -b tworzy gałąź o tej samej nazwie; bez tego worktree wisiałby na HEAD.
    await git(root, ['worktree', 'add', '-b', trimmed, path]);
    return { ok: true, path };
  } catch (error) {
    const text = messageOf(error);
    if (/already exists|already checked out/i.test(text)) {
      return { ok: false, error: 'exists' };
    }
    return { ok: false, error: 'failed', detail: text.slice(0, 400) };
  }
}

export async function removeWorktree(root: string, path: string): Promise<WorktreeWriteResult> {
  try {
    await git(root, ['worktree', 'remove', path]);
    return { ok: true, path };
  } catch (error) {
    const text = messageOf(error);
    // Niescommitowane zmiany są powodem do zatrzymania się, nie do `--force`.
    if (/contains modified or untracked files|is dirty/i.test(text)) {
      return { ok: false, error: 'dirty' };
    }
    return { ok: false, error: 'failed', detail: text.slice(0, 400) };
  }
}

/**
 * Scala gałąź worktree'a do gałęzi bazowej — merge idzie w katalogu głównym
 * projektu, bo to jego HEAD ma przyjąć zmianę. Konflikt kończy się
 * komunikatem i **przerwaniem** scalania: rozwiązywanie zostawiamy człowiekowi
 * w terminalu, żaden automat nie dotyka cudzych zmian.
 */
export async function mergeWorktree(
  root: string,
  branch: string,
): Promise<WorktreeMergeResult> {
  const into = await currentBranch(root);
  if (branch.trim() === '') {
    return { ok: false, error: 'invalid-name', into };
  }
  try {
    await git(root, ['merge', '--no-ff', '--no-edit', branch]);
    return { ok: true, into };
  } catch (error) {
    const text = messageOf(error);
    if (/CONFLICT|Automatic merge failed/i.test(text)) {
      try {
        await git(root, ['merge', '--abort']);
      } catch {
        // Merge mógł się nie rozpocząć — wtedy nie ma czego przerywać.
      }
      return { ok: false, error: 'conflict', into };
    }
    if (/local changes|would be overwritten|not something we can merge/i.test(text)) {
      return { ok: false, error: 'dirty', into };
    }
    return { ok: false, error: 'failed', into, detail: text.slice(0, 400) };
  }
}
