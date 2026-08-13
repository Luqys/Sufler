import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPatch,
  hunkPreview,
  hunkStats,
  parseUnifiedDiff,
} from '../../src/shared/git/hunks';

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** Repo z plikiem, w którym da się zrobić dwie osobne, odległe zmiany. */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-hunk-'));
  git(dir, ['init', '--quiet', '--initial-branch=main']);
  git(dir, ['config', 'user.email', 'e2e@vn3o.test']);
  git(dir, ['config', 'user.name', 'e2e']);
  const lines = Array.from({ length: 30 }, (_, index) => `wiersz ${index + 1}`);
  writeFileSync(join(dir, 'plik.txt'), lines.join('\n') + '\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'init']);
  return dir;
}

/** Dwie zmiany oddalone od siebie — git zrobi z nich dwa hunki. */
function makeTwoChanges(dir: string): void {
  const lines = readFileSync(join(dir, 'plik.txt'), 'utf8').split('\n');
  lines[1] = 'ZMIANA NA GÓRZE';
  lines[24] = 'ZMIANA NA DOLE';
  writeFileSync(join(dir, 'plik.txt'), lines.join('\n'));
}

describe('parseUnifiedDiff', () => {
  it('rozbija wyjście na pliki i hunki z policzonymi zakresami', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const files = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']));

    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe('plik.txt');
    expect(files[0]?.hunks).toHaveLength(2);
    expect(files[0]?.hunks[0]?.oldStart).toBeGreaterThan(0);
    expect(files[0]?.head.some((line) => line.startsWith('--- '))).toBe(true);
  });

  it('nagłówek bez licznika znaczy jeden wiersz', () => {
    const files = parseUnifiedDiff(
      ['diff --git a/a.txt b/a.txt', '--- a/a.txt', '+++ b/a.txt', '@@ -1 +1 @@', '-a', '+b'].join(
        '\n',
      ),
    );
    expect(files[0]?.hunks[0]).toMatchObject({ oldCount: 1, newCount: 1 });
  });

  it('plik binarny jest oznaczony i nie ma hunków', () => {
    const files = parseUnifiedDiff(
      [
        'diff --git a/obraz.png b/obraz.png',
        'index 111..222 100644',
        'Binary files a/obraz.png and b/obraz.png differ',
      ].join('\n'),
    );
    expect(files[0]?.binary).toBe(true);
    expect(files[0]?.hunks).toEqual([]);
  });

  it('puste wyjście daje pustą listę', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });
});

describe('hunkStats / hunkPreview', () => {
  it('liczy dodane i usunięte wiersze', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const hunk = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']))[0]?.hunks[0];
    expect(hunkStats(hunk!)).toEqual({ added: 1, removed: 1 });
  });

  it('podgląd bierze pierwszy zmieniony wiersz bez prefiksu', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const hunk = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']))[0]?.hunks[0];
    expect(hunkPreview(hunk!)).toBe('wiersz 2');
  });
});

describe('buildPatch — prawdziwy git apply', () => {
  it('łatka z JEDNEGO hunka wpuszcza do indeksu tylko tę zmianę', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const file = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']))[0]!;

    const patch = buildPatch(file, [0]);
    writeFileSync(join(dir, 'latka.diff'), patch);
    git(dir, ['apply', '--cached', 'latka.diff']);

    // W indeksie jest górna zmiana…
    const staged = git(dir, ['diff', '--cached']);
    expect(staged).toContain('ZMIANA NA GÓRZE');
    expect(staged).not.toContain('ZMIANA NA DOLE');
    // …a dolna została w drzewie roboczym.
    const unstaged = git(dir, ['diff']);
    expect(unstaged).toContain('ZMIANA NA DOLE');
    expect(unstaged).not.toContain('ZMIANA NA GÓRZE');
  });

  it('DRUGI hunk osobno też się nakłada — numeracja strony „po" przeliczona', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const file = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']))[0]!;

    writeFileSync(join(dir, 'latka.diff'), buildPatch(file, [1]));
    git(dir, ['apply', '--cached', 'latka.diff']);

    const staged = git(dir, ['diff', '--cached']);
    expect(staged).toContain('ZMIANA NA DOLE');
    expect(staged).not.toContain('ZMIANA NA GÓRZE');
  });

  it('oba hunki naraz dają to samo, co zwykłe `git add`', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const file = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']))[0]!;

    writeFileSync(join(dir, 'latka.diff'), buildPatch(file, [0, 1]));
    git(dir, ['apply', '--cached', 'latka.diff']);

    expect(git(dir, ['diff']).trim()).toBe(''); // nic nie zostało w drzewie
    const staged = git(dir, ['diff', '--cached']);
    expect(staged).toContain('ZMIANA NA GÓRZE');
    expect(staged).toContain('ZMIANA NA DOLE');
  });

  it('kolejność zaznaczenia nie ma znaczenia, duplikaty są znoszone', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const file = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']))[0]!;
    expect(buildPatch(file, [1, 0, 1])).toBe(buildPatch(file, [0, 1]));
  });

  it('puste zaznaczenie daje pustą łatkę, a nie łatkę bez hunków', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    const file = parseUnifiedDiff(git(dir, ['diff', '--', 'plik.txt']))[0]!;
    expect(buildPatch(file, [])).toBe('');
    expect(buildPatch(file, [7])).toBe('');
  });
});
