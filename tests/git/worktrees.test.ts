import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseWorktreeList,
  validateWorktreeName,
  worktreeLabel,
  worktreePathFor,
} from '../../src/shared/git/worktrees';
import {
  addWorktree,
  currentBranch,
  listWorktrees,
  mergeWorktree,
  removeWorktree,
} from '../../src/main/git/worktrees';

/** Zamrożone wyjście `git worktree list --porcelain` (git 2.4x). */
const LIST = [
  '/Users/kto/projekt',
  'HEAD 8d24bcdaa1',
  'branch refs/heads/main',
  '',
  '/Users/kto/projekt-worktrees/m82-eksperyment',
  'HEAD 4be37b2ff0',
  'branch refs/heads/m82-eksperyment',
  '',
  '/Users/kto/projekt-worktrees/odlaczony',
  'HEAD 1111111111',
  'detached',
  'locked',
  '',
]
  .map((line) => (line.startsWith('/') ? `worktree ${line}` : line))
  .join('\n');

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-wt-'));
  git(dir, ['init', '--quiet', '--initial-branch=main']);
  git(dir, ['config', 'user.email', 'e2e@vn3o.test']);
  git(dir, ['config', 'user.name', 'e2e']);
  writeFileSync(join(dir, 'plik.txt'), 'wersja 1\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'init']);
  return dir;
}

describe('parseWorktreeList', () => {
  it('czyta ścieżkę, gałąź i HEAD każdego bloku', () => {
    const items = parseWorktreeList(LIST);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      path: '/Users/kto/projekt',
      branch: 'main',
      head: '8d24bcdaa1',
      main: true,
      locked: false,
    });
    expect(items[1]?.branch).toBe('m82-eksperyment');
  });

  it('pierwszy wpis jest katalogiem głównym, reszta nie', () => {
    expect(parseWorktreeList(LIST).map((item) => item.main)).toEqual([true, false, false]);
  });

  it('odłączony HEAD nie ma gałęzi, a blokada jest widoczna', () => {
    const detached = parseWorktreeList(LIST)[2];
    expect(detached?.branch).toBe('');
    expect(detached?.locked).toBe(true);
  });

  it('puste wyjście daje pustą listę', () => {
    expect(parseWorktreeList('')).toEqual([]);
  });
});

describe('validateWorktreeName', () => {
  it('przepuszcza zwykłe nazwy gałęzi', () => {
    expect(validateWorktreeName('m82-eksperyment')).toBeNull();
    expect(validateWorktreeName('feature/logowanie')).toBeNull();
  });

  it('odrzuca puste, za długie i niepoprawne dla gita', () => {
    expect(validateWorktreeName('   ')).toBe('empty');
    expect(validateWorktreeName('a'.repeat(65))).toBe('too-long');
    for (const bad of ['-start', 'kropka.', 'coś.lock', 'a..b', 'spacja w środku', 'ptaszek~']) {
      expect(validateWorktreeName(bad)).toBe('invalid');
    }
  });
});

describe('worktreePathFor / worktreeLabel', () => {
  it('katalog powstaje OBOK projektu, nie w środku', () => {
    expect(worktreePathFor('/Users/kto/projekt', 'm82')).toBe(
      '/Users/kto/projekt-worktrees/m82',
    );
    // Ukośnik w nazwie gałęzi nie może tworzyć zagnieżdżonych katalogów.
    expect(worktreePathFor('/Users/kto/projekt/', 'feature/logowanie')).toBe(
      '/Users/kto/projekt-worktrees/feature-logowanie',
    );
  });

  it('etykieta to gałąź, a przy odłączonym HEAD nazwa katalogu', () => {
    const items = parseWorktreeList(LIST);
    expect(worktreeLabel(items[1]!)).toBe('m82-eksperyment');
    expect(worktreeLabel(items[2]!)).toBe('odlaczony');
  });
});

describe('operacje na worktree', () => {
  it('dodanie tworzy katalog i gałąź, lista je pokazuje', async () => {
    const root = makeRepo();
    const result = await addWorktree(root, 'm82-eksperyment');

    expect(result.ok).toBe(true);
    expect(existsSync(`${root}-worktrees/m82-eksperyment`)).toBe(true);
    const items = await listWorktrees(root);
    expect(items).toHaveLength(2);
    expect(items[1]?.branch).toBe('m82-eksperyment');
    expect(await currentBranch(root)).toBe('main');
  });

  it('druga próba tej samej nazwy mówi „istnieje", nie wybucha', async () => {
    const root = makeRepo();
    await addWorktree(root, 'duplikat');
    expect(await addWorktree(root, 'duplikat')).toEqual({ ok: false, error: 'exists' });
  });

  it('niepoprawna nazwa nie dociera do gita', async () => {
    const root = makeRepo();
    expect(await addWorktree(root, 'zła nazwa')).toEqual({ ok: false, error: 'invalid-name' });
  });

  it('scalanie wciąga pracę z worktree do gałęzi projektu', async () => {
    const root = makeRepo();
    const added = await addWorktree(root, 'm82-praca');
    const path = added.ok ? added.path : '';
    writeFileSync(join(path, 'nowy.txt'), 'z worktree\n');
    git(path, ['add', '-A']);
    git(path, ['commit', '--quiet', '-m', 'praca w worktree']);

    const merged = await mergeWorktree(root, 'm82-praca');

    expect(merged).toEqual({ ok: true, into: 'main' });
    expect(existsSync(join(root, 'nowy.txt'))).toBe(true);
    expect(git(root, ['log', '-1', '--format=%s']).trim()).toContain('m82-praca');
  });

  it('konflikt przerywa scalanie i zostawia repo w spokoju', async () => {
    const root = makeRepo();
    const added = await addWorktree(root, 'm82-konflikt');
    const path = added.ok ? added.path : '';
    writeFileSync(join(path, 'plik.txt'), 'wersja z worktree\n');
    git(path, ['add', '-A']);
    git(path, ['commit', '--quiet', '-m', 'zmiana w worktree']);
    writeFileSync(join(root, 'plik.txt'), 'wersja z projektu\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '--quiet', '-m', 'zmiana w projekcie']);

    const merged = await mergeWorktree(root, 'm82-konflikt');

    expect(merged).toMatchObject({ ok: false, error: 'conflict', into: 'main' });
    // Po przerwaniu nie zostaje rozgrzebany merge ani ślad konfliktu w pliku.
    expect(git(root, ['status', '--porcelain']).trim()).toBe('');
    expect(git(root, ['log', '-1', '--format=%s']).trim()).toBe('zmiana w projekcie');
  });

  it('usunięcie czyści katalog, ale nie rusza worktree z niezapisanymi zmianami', async () => {
    const root = makeRepo();
    const added = await addWorktree(root, 'm82-do-usuniecia');
    const path = added.ok ? added.path : '';
    writeFileSync(join(path, 'brudny.txt'), 'niezapisane\n');

    expect(await removeWorktree(root, path)).toEqual({ ok: false, error: 'dirty' });
    expect(existsSync(path)).toBe(true);

    git(path, ['clean', '-fd']);
    expect((await removeWorktree(root, path)).ok).toBe(true);
    expect(existsSync(path)).toBe(false);
  });
});
