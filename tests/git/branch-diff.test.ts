import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  baseSideFor,
  parseNameStatusZ,
  sortBranchDiff,
} from '../../src/shared/git/branch-diff';
import { diffAgainstBase } from '../../src/main/git/branch-diff';
import { addWorktree } from '../../src/main/git/worktrees';

/** Zamrożone wyjście `git diff --name-status -z` (rekordy rozdzielone \0). */
const NAME_STATUS_Z = [
  'M', 'src/main/index.ts',
  'A', 'src/nowy plik.ts',
  'D', 'src/stary.ts',
  'R100', 'src/przed.ts', 'src/po.ts',
  '',
].join('\0');

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-bdiff-'));
  git(dir, ['init', '--quiet', '--initial-branch=main']);
  git(dir, ['config', 'user.email', 'e2e@vn3o.test']);
  git(dir, ['config', 'user.name', 'e2e']);
  writeFileSync(join(dir, 'plik.txt'), 'wersja 1\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'init']);
  return dir;
}

describe('parseNameStatusZ', () => {
  it('czyta statusy i ścieżki, także ze spacjami', () => {
    const files = parseNameStatusZ(NAME_STATUS_Z);
    expect(files).toHaveLength(4);
    expect(files[1]).toEqual({ status: 'A', path: 'src/nowy plik.ts', oldPath: '' });
  });

  it('zmiana nazwy niesie starą i nową ścieżkę', () => {
    const rename = parseNameStatusZ(NAME_STATUS_Z)[3];
    expect(rename).toEqual({ status: 'R', path: 'src/po.ts', oldPath: 'src/przed.ts' });
  });

  it('puste wyjście daje pustą listę', () => {
    expect(parseNameStatusZ('')).toEqual([]);
    expect(parseNameStatusZ('\0\0')).toEqual([]);
  });
});

describe('sortBranchDiff', () => {
  it('dodane i zmienione przed usuniętymi, dalej alfabetycznie', () => {
    const sorted = sortBranchDiff(parseNameStatusZ(NAME_STATUS_Z));
    expect(sorted.map((file) => file.status)).toEqual(['A', 'M', 'R', 'D']);
  });
});

describe('baseSideFor', () => {
  it('plik dodany nie ma strony „przed"', () => {
    expect(baseSideFor({ status: 'A', path: 'a', oldPath: '' }, 'abc123')).toBeNull();
    expect(baseSideFor({ status: 'M', path: 'a', oldPath: '' }, 'abc123')).toBe('abc123');
  });
});

describe('diffAgainstBase', () => {
  it('pokazuje, co wniosła gałąź worktree’a', async () => {
    const root = makeRepo();
    const added = await addWorktree(root, 'm86-praca');
    const path = added.ok ? added.path : '';
    writeFileSync(join(path, 'nowy.txt'), 'z worktree\n');
    writeFileSync(join(path, 'plik.txt'), 'wersja 2\n');
    git(path, ['add', '-A']);
    git(path, ['commit', '--quiet', '-m', 'praca']);

    const diff = await diffAgainstBase(root, 'm86-praca', 'main');

    expect(diff?.files.map((file) => `${file.status} ${file.path}`)).toEqual([
      'A nowy.txt',
      'M plik.txt',
    ]);
    // Zakładka diffa dostaje SHA, nie nazwę gałęzi — `runGitShowFile`
    // przepuszcza wyłącznie HEAD i sha.
    expect(diff?.tip).toMatch(/^[0-9a-f]{40}$/);
    expect(diff?.tip).toBe(git(path, ['rev-parse', 'HEAD']).trim());
  });

  it('liczy od punktu ROZEJŚCIA, więc praca na bazie nie zanieczyszcza wyniku', async () => {
    const root = makeRepo();
    const added = await addWorktree(root, 'm86-rownolegle');
    const path = added.ok ? added.path : '';
    writeFileSync(join(path, 'z-worktree.txt'), 'moje\n');
    git(path, ['add', '-A']);
    git(path, ['commit', '--quiet', '-m', 'praca w worktree']);
    // W międzyczasie ktoś dołożył commit na gałęzi bazowej.
    writeFileSync(join(root, 'z-maina.txt'), 'cudze\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '--quiet', '-m', 'praca na mainie']);

    const diff = await diffAgainstBase(root, 'm86-rownolegle', 'main');

    // Widać tylko wkład worktree'a; plik z maina się nie pojawia.
    expect(diff?.files.map((file) => file.path)).toEqual(['z-worktree.txt']);
  });

  it('gałąź bez własnych commitów nie wnosi nic', async () => {
    const root = makeRepo();
    await addWorktree(root, 'm86-pusta');
    const diff = await diffAgainstBase(root, 'm86-pusta', 'main');
    expect(diff?.files).toEqual([]);
  });

  it('nieznana gałąź i porównanie z samą sobą dają null', async () => {
    const root = makeRepo();
    expect(await diffAgainstBase(root, 'nie-ma-takiej', 'main')).toBeNull();
    expect(await diffAgainstBase(root, 'main', 'main')).toBeNull();
  });
});
