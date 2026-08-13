import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  parseNameStatusZ,
  sortBranchDiff,
  type BranchDiff,
} from '../../shared/git/branch-diff';

const execFileAsync = promisify(execFile);

/**
 * Różnica gałęzi worktree'a wobec bazy (M86). Liczymy od punktu rozejścia
 * (`merge-base`), nie od czubka bazy — inaczej praca, która w międzyczasie
 * weszła na bazę, pokazywałaby się jako „zmiany worktree'a" i porównanie
 * kłamałoby o tym, co ten worktree wniósł.
 */

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
}

export async function diffAgainstBase(
  root: string,
  branch: string,
  base: string,
): Promise<BranchDiff | null> {
  if (branch.trim() === '' || base.trim() === '' || branch === base) {
    return null;
  }
  try {
    const mergeBase = (await git(root, ['merge-base', base, branch])).trim();
    if (mergeBase === '') {
      return null;
    }
    const tip = (await git(root, ['rev-parse', branch])).trim();
    if (tip === '') {
      return null;
    }
    const stdout = await git(root, ['diff', '--name-status', '-z', mergeBase, tip]);
    return { base, mergeBase, tip, files: sortBranchDiff(parseNameStatusZ(stdout)) };
  } catch {
    // Gałąź zniknęła albo to nie jest repozytorium — panel pokaże pustkę.
    return null;
  }
}
