import { describe, expect, it } from 'vitest';
import { parseGitLog } from '../../src/main/git/git-log';

const F = '\x1f';
const R = '\x1e';

const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);
const HASH_C = 'c'.repeat(40);

describe('parseGitLog', () => {
  it('parsuje rodziców, temat i wielolinijkowy opis (%b)', () => {
    const stdout =
      `${HASH_A}${F}${HASH_B} ${HASH_C}${F}Szymon${F}2026-08-10T12:00:00+02:00${F}merge: M20${F}` +
      `Szczegóły zmian:\n- graf gałęzi w historii git\n${R}\n` +
      `${HASH_B}${F}${F}e2e${F}2026-08-09T10:00:00+02:00${F}init${F}${R}`;
    const commits = parseGitLog(stdout);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      hash: HASH_A,
      shortHash: 'aaaaaaa',
      parents: [HASH_B, HASH_C],
      author: 'Szymon',
      subject: 'merge: M20',
      body: 'Szczegóły zmian:\n- graf gałęzi w historii git',
    });
    expect(commits[1]?.parents).toEqual([]);
    expect(commits[1]?.body).toBe('');
  });

  it('pomija rekordy niekompletne i puste', () => {
    expect(parseGitLog('')).toHaveLength(0);
    expect(parseGitLog(`${F}${F}${R}`)).toHaveLength(0);
  });
});
