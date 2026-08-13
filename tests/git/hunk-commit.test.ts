import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commitHunks, readFileHunks } from '../../src/main/git/hunk-commit';

function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-hcommit-'));
  git(dir, ['init', '--quiet', '--initial-branch=main']);
  git(dir, ['config', 'user.email', 'e2e@vn3o.test']);
  git(dir, ['config', 'user.name', 'e2e']);
  const lines = Array.from({ length: 30 }, (_, index) => `wiersz ${index + 1}`);
  writeFileSync(join(dir, 'plik.txt'), lines.join('\n') + '\n');
  writeFileSync(join(dir, 'inny.txt'), 'bez zmian\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'init']);
  return dir;
}

function makeTwoChanges(dir: string): void {
  const lines = readFileSync(join(dir, 'plik.txt'), 'utf8').split('\n');
  lines[1] = 'ZMIANA NA GÓRZE';
  lines[24] = 'ZMIANA NA DOLE';
  writeFileSync(join(dir, 'plik.txt'), lines.join('\n'));
}

describe('readFileHunks', () => {
  it('liczy hunki wobec HEAD, nie wobec indeksu', () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    git(dir, ['add', 'plik.txt']); // zmiany są już w indeksie…

    // …a mimo to hunki mają być widoczne, bo liczymy wobec HEAD.
    return readFileHunks(dir, 'plik.txt').then((file) => {
      expect(file?.hunks).toHaveLength(2);
    });
  });

  it('ścieżka spoza projektu jest odrzucana', async () => {
    expect(await readFileHunks(makeRepo(), '../poza.txt')).toBeNull();
  });
});

describe('commitHunks', () => {
  it('zatwierdza JEDEN fragment, resztę zostawia w drzewie', async () => {
    const dir = makeRepo();
    makeTwoChanges(dir);

    const result = await commitHunks(dir, [{ path: 'plik.txt', hunks: [0] }], 'Tylko górna zmiana');

    expect(result.ok).toBe(true);
    // W commicie jest górna zmiana…
    const committed = git(dir, ['show', 'HEAD:plik.txt']);
    expect(committed).toContain('ZMIANA NA GÓRZE');
    expect(committed).not.toContain('ZMIANA NA DOLE');
    // …a dolna nadal czeka w drzewie roboczym.
    expect(git(dir, ['diff', '--', 'plik.txt'])).toContain('ZMIANA NA DOLE');
    expect(git(dir, ['log', '-1', '--format=%s']).trim()).toBe('Tylko górna zmiana');
  });

  it('NIE rusza indeksu użytkownika', async () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    // Ktoś zastage'ował osobny plik i to ma tam zostać.
    writeFileSync(join(dir, 'inny.txt'), 'zastage-owane\n');
    git(dir, ['add', 'inny.txt']);
    const indexBefore = git(dir, ['diff', '--cached', '--name-only']).trim();

    await commitHunks(dir, [{ path: 'plik.txt', hunks: [1] }], 'Dolna zmiana');

    // Indeks ma nadal dokładnie to, co miał — commit go nie skonsumował.
    expect(git(dir, ['diff', '--cached', '--name-only']).trim()).toBe(indexBefore);
    expect(git(dir, ['show', 'HEAD:inny.txt']).trim()).toBe('bez zmian');
  });

  it('pusta lista hunków znaczy cały plik', async () => {
    const dir = makeRepo();
    makeTwoChanges(dir);

    await commitHunks(dir, [{ path: 'plik.txt', hunks: [] }], 'Cały plik');

    const committed = git(dir, ['show', 'HEAD:plik.txt']);
    expect(committed).toContain('ZMIANA NA GÓRZE');
    expect(committed).toContain('ZMIANA NA DOLE');
    expect(git(dir, ['diff', '--', 'plik.txt']).trim()).toBe('');
  });

  it('odmawia bez zaznaczenia, bez opisu i na niebezpiecznej ścieżce', async () => {
    const dir = makeRepo();
    makeTwoChanges(dir);

    expect(await commitHunks(dir, [], 'Opis')).toEqual({ ok: false, error: 'nothing-selected' });
    expect(await commitHunks(dir, [{ path: 'plik.txt', hunks: [0] }], ' ')).toEqual({
      ok: false,
      error: 'empty-message',
    });
    expect(await commitHunks(dir, [{ path: '../poza.txt', hunks: [0] }], 'Opis')).toEqual({
      ok: false,
      error: 'bad-path',
    });
  });

  it('zaznaczenie, które nic nie zmienia, kończy się „nie ma czego zatwierdzać"', async () => {
    const dir = makeRepo();
    // Brak zmian w pliku — łatka byłaby pusta.
    expect(await commitHunks(dir, [{ path: 'plik.txt', hunks: [] }], 'Opis')).toEqual({
      ok: false,
      error: 'nothing-to-commit',
    });
  });

  it('dwa pliki naraz: fragment z jednego, całość z drugiego', async () => {
    const dir = makeRepo();
    makeTwoChanges(dir);
    writeFileSync(join(dir, 'inny.txt'), 'nowa treść\n');

    const result = await commitHunks(
      dir,
      [
        { path: 'plik.txt', hunks: [0] },
        { path: 'inny.txt', hunks: [] },
      ],
      'Dwa pliki',
    );

    expect(result).toMatchObject({ ok: true, files: 2 });
    expect(git(dir, ['show', 'HEAD:inny.txt']).trim()).toBe('nowa treść');
    expect(git(dir, ['show', 'HEAD:plik.txt'])).not.toContain('ZMIANA NA DOLE');
  });
});
