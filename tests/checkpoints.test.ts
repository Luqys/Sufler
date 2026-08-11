import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkpointSubject,
  labelFromSubject,
  parseCheckpointLog,
} from '../src/shared/checkpoints';
import { createCheckpoint, listCheckpoints, restoreCheckpoint } from '../src/main/checkpoints';

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-ckpt-'));
  const git = (args: string) =>
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args.split(' ')], {
      cwd: dir,
      stdio: 'ignore',
    });
  git('init');
  writeFileSync(join(dir, 'plik.txt'), 'wersja 1\n');
  git('add -A');
  git('commit -m init');
  return dir;
}

describe('checkpointSubject / labelFromSubject', () => {
  it('etykieta przechodzi przez temat commita w obie strony', () => {
    expect(labelFromSubject(checkpointSubject('Napraw limity planu'))).toBe('Napraw limity planu');
  });

  it('puste polecenie dostaje zapasowy opis, długie jest przycinane', () => {
    expect(labelFromSubject(checkpointSubject('   '))).toBe('przed pracą Claude');
    const long = labelFromSubject(checkpointSubject('x'.repeat(200))) ?? '';
    expect(long.length).toBeLessThanOrEqual(72);
    expect(long.endsWith('…')).toBe(true);
  });

  it('cudze commity nie są migawkami', () => {
    expect(labelFromSubject('zwykły commit')).toBeNull();
  });
});

describe('parseCheckpointLog', () => {
  it('czyta format hash/data/temat i pomija obce wiersze', () => {
    const stdout = [
      `abc123\x1f2026-08-11T01:00:00+02:00\x1f${checkpointSubject('pierwsze')}`,
      'def456\x1f2026-08-11T00:00:00+02:00\x1fcudzy commit',
      '',
    ].join('\n');
    const parsed = parseCheckpointLog(stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ shortHash: 'abc123', label: 'pierwsze' });
  });
});

describe('createCheckpoint / restoreCheckpoint', () => {
  it('migawka nie rusza HEAD ani indeksu, a przywracanie wraca do treści', async () => {
    const root = makeRepo();
    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });

    writeFileSync(join(root, 'plik.txt'), 'wersja 2\n');
    const first = await createCheckpoint(root, 'przed zmianą');
    expect(first).toBeTruthy();

    // HEAD i status roboczy nietknięte — migawka żyje w osobnym refie.
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })).toBe(
      headBefore,
    );
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    expect(status).toContain('plik.txt');

    // Claude „psuje" plik, przywracamy migawkę.
    writeFileSync(join(root, 'plik.txt'), 'zepsute\n');
    const restored = await restoreCheckpoint(root, first!);
    expect(restored.ok).toBe(true);
    expect(readFileSync(join(root, 'plik.txt'), 'utf8')).toBe('wersja 2\n');

    // Przywracanie samo zostawia migawkę stanu sprzed cofnięcia.
    const list = await listCheckpoints(root);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0]?.label).toBe('stan przed przywróceniem');
  });

  it('brak zmian nie mnoży migawek', async () => {
    const root = makeRepo();
    writeFileSync(join(root, 'plik.txt'), 'zmiana\n');
    expect(await createCheckpoint(root, 'raz')).toBeTruthy();
    expect(await createCheckpoint(root, 'dwa')).toBeNull();
    expect(await listCheckpoints(root)).toHaveLength(1);
  });

  it('poza repozytorium git migawki nie powstają', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vn3o-norepo-'));
    expect(await createCheckpoint(dir, 'x')).toBeNull();
    expect(await listCheckpoints(dir)).toEqual([]);
  });
});
