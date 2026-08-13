import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canCommit,
  commitMessageProblem,
  commitSubject,
  isSafeRelativePath,
  normalizeCommitMessage,
  plannedPaths,
} from '../../src/shared/git/git-commit';
import { runGitCommit } from '../../src/main/git/git-commit';

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** Repo z jednym commitem i skonfigurowanym autorem (commit idzie bez `-c`). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-commit-'));
  git(dir, ['init', '--quiet']);
  git(dir, ['config', 'user.email', 'e2e@vn3o.test']);
  git(dir, ['config', 'user.name', 'e2e']);
  writeFileSync(join(dir, 'a.txt'), 'wersja 1\n');
  writeFileSync(join(dir, 'b.txt'), 'wersja 1\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'init']);
  return dir;
}

function status(dir: string): string {
  return git(dir, ['status', '--porcelain']);
}

describe('commitMessageProblem', () => {
  it('pusty opis blokuje zatwierdzenie', () => {
    expect(commitMessageProblem('')).toBe('empty');
    expect(commitMessageProblem('   \n\t ')).toBe('empty');
  });

  it('opis z treścią przechodzi', () => {
    expect(commitMessageProblem('Naprawa panelu')).toBeNull();
  });
});

describe('normalizeCommitMessage', () => {
  it('ucina spacje na końcach wierszy i puste wiersze na brzegach', () => {
    expect(normalizeCommitMessage('\n\n  Temat   \n\nTreść  \n\n\n')).toBe('Temat\n\nTreść');
  });

  it('zwija ciągi pustych wierszy do jednego', () => {
    expect(normalizeCommitMessage('Temat\n\n\n\nTreść')).toBe('Temat\n\nTreść');
  });

  it('normalizuje końce wierszy z CRLF', () => {
    expect(normalizeCommitMessage('Temat\r\nTreść')).toBe('Temat\nTreść');
  });
});

describe('commitSubject', () => {
  it('bierze pierwszy wiersz opisu', () => {
    expect(commitSubject('Temat commita\n\nDłuższa treść')).toBe('Temat commita');
  });

  it('skraca długi temat wielokropkiem', () => {
    expect(commitSubject('a'.repeat(80), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('isSafeRelativePath', () => {
  it('przepuszcza ścieżki względne w projekcie', () => {
    expect(isSafeRelativePath('src/main/index.ts')).toBe(true);
  });

  it('odrzuca ścieżki absolutne, wyjścia w górę i puste', () => {
    for (const path of ['', '/etc/passwd', '../poza', 'src/../../poza', 'C:\\Windows']) {
      expect(isSafeRelativePath(path)).toBe(false);
    }
  });
});

describe('plannedPaths', () => {
  const files = [{ path: 'b.txt' }, { path: 'a.txt' }];

  it('bierze przecięcie zaznaczenia z aktualną listą zmian, posortowane', () => {
    expect(plannedPaths(files, ['b.txt', 'a.txt'])).toEqual(['a.txt', 'b.txt']);
  });

  it('pomija zaznaczenie, którego nie ma już na liście', () => {
    expect(plannedPaths(files, ['a.txt', 'zniknięty.txt'])).toEqual(['a.txt']);
  });

  it('odrzuca ścieżki niebezpieczne, nawet gdy przyszły z listy', () => {
    expect(plannedPaths([{ path: '../poza.txt' }], ['../poza.txt'])).toEqual([]);
  });
});

describe('canCommit', () => {
  const files = [{ path: 'a.txt' }];

  it('wymaga i zaznaczenia, i opisu', () => {
    expect(canCommit(files, [], 'Opis')).toBe(false);
    expect(canCommit(files, ['a.txt'], '  ')).toBe(false);
    expect(canCommit(files, ['a.txt'], 'Opis')).toBe(true);
  });
});

describe('runGitCommit', () => {
  it('zatwierdza wyłącznie zaznaczony plik, resztę zostawia w drzewie', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'a.txt'), 'wersja 2\n');
    writeFileSync(join(dir, 'b.txt'), 'wersja 2\n');

    const result = await runGitCommit(dir, ['a.txt'], 'Zmiana w a');

    expect(result).toMatchObject({ ok: true, files: 1 });
    expect(git(dir, ['log', '-1', '--format=%s']).trim()).toBe('Zmiana w a');
    expect(git(dir, ['show', '--name-only', '--format=', 'HEAD']).trim()).toBe('a.txt');
    expect(status(dir)).toBe(' M b.txt\n');
  });

  it('zatwierdza plik nieśledzony', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'nowy.txt'), 'treść\n');

    const result = await runGitCommit(dir, ['nowy.txt'], 'Nowy plik');

    expect(result.ok).toBe(true);
    expect(status(dir)).toBe('');
    expect(git(dir, ['show', '--name-only', '--format=', 'HEAD']).trim()).toBe('nowy.txt');
  });

  it('nie rusza cudzego indeksu — plik zastage\u0027owany osobno zostaje w indeksie', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'a.txt'), 'wersja 2\n');
    writeFileSync(join(dir, 'b.txt'), 'wersja 2\n');
    git(dir, ['add', 'b.txt']);

    await runGitCommit(dir, ['a.txt'], 'Tylko a');

    expect(git(dir, ['show', '--name-only', '--format=', 'HEAD']).trim()).toBe('a.txt');
    expect(status(dir)).toBe('M  b.txt\n');
  });

  it('zapisuje wielowierszowy opis w znormalizowanej postaci', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'a.txt'), 'wersja 2\n');

    await runGitCommit(dir, ['a.txt'], '  Temat  \n\n\n\nUzasadnienie  \n\n');

    expect(git(dir, ['log', '-1', '--format=%B']).trim()).toBe('Temat\n\nUzasadnienie');
  });

  it('odmawia bez zaznaczenia, bez opisu i na niebezpiecznej ścieżce', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'a.txt'), 'wersja 2\n');

    expect(await runGitCommit(dir, [], 'Opis')).toEqual({ ok: false, error: 'nothing-selected' });
    expect(await runGitCommit(dir, ['a.txt'], ' ')).toEqual({ ok: false, error: 'empty-message' });
    expect(await runGitCommit(dir, ['../poza.txt'], 'Opis')).toEqual({
      ok: false,
      error: 'bad-path',
    });
  });

  it('poza repozytorium zwraca not-a-repo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vn3o-nierepo-'));
    writeFileSync(join(dir, 'a.txt'), 'treść\n');

    expect(await runGitCommit(dir, ['a.txt'], 'Opis')).toEqual({ ok: false, error: 'not-a-repo' });
  });

  it('rozpoznaje brak skonfigurowanego autora', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vn3o-bezautora-'));
    git(dir, ['init', '--quiet']);
    writeFileSync(join(dir, 'a.txt'), 'treść\n');
    const saved = { name: process.env['GIT_AUTHOR_NAME'], email: process.env['GIT_AUTHOR_EMAIL'] };
    process.env['GIT_AUTHOR_NAME'] = '';
    process.env['GIT_AUTHOR_EMAIL'] = '';
    try {
      expect(await runGitCommit(dir, ['a.txt'], 'Opis')).toEqual({
        ok: false,
        error: 'identity-missing',
      });
    } finally {
      process.env['GIT_AUTHOR_NAME'] = saved.name ?? '';
      process.env['GIT_AUTHOR_EMAIL'] = saved.email ?? '';
      if (saved.name === undefined) {
        delete process.env['GIT_AUTHOR_NAME'];
      }
      if (saved.email === undefined) {
        delete process.env['GIT_AUTHOR_EMAIL'];
      }
    }
  });

  it('działa w repozytorium bez żadnego commita', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vn3o-pusty-'));
    git(dir, ['init', '--quiet']);
    git(dir, ['config', 'user.email', 'e2e@vn3o.test']);
    git(dir, ['config', 'user.name', 'e2e']);
    writeFileSync(join(dir, 'pierwszy.txt'), 'treść\n');

    const result = await runGitCommit(dir, ['pierwszy.txt'], 'Pierwszy commit');

    expect(result.ok).toBe(true);
    expect(git(dir, ['log', '-1', '--format=%s']).trim()).toBe('Pierwszy commit');
  });
});
