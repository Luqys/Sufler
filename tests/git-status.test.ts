import { describe, expect, it } from 'vitest';
import { parseGitStatusPorcelainZ } from '../src/main/git-status';

describe('parseGitStatusPorcelainZ', () => {
  it('rozpoznaje zmodyfikowane i nieśledzone (fixture z rzeczywistego gita)', () => {
    const output = ' M plik ze spacją.txt\0?? zwykly.txt\0';
    expect(parseGitStatusPorcelainZ(output)).toEqual([
      { path: 'plik ze spacją.txt', state: 'modified' },
      { path: 'zwykly.txt', state: 'untracked' },
    ]);
  });

  it('staged, rename i katalogi nieśledzone', () => {
    const output = 'M  a.ts\0A  nowy.ts\0R  nowa-nazwa.ts\0stara-nazwa.ts\0?? katalog/\0';
    expect(parseGitStatusPorcelainZ(output)).toEqual([
      { path: 'a.ts', state: 'modified' },
      { path: 'nowy.ts', state: 'modified' },
      { path: 'nowa-nazwa.ts', state: 'modified' },
      { path: 'katalog', state: 'untracked' },
    ]);
  });

  it('pomija usunięte i ignorowane', () => {
    const output = ' D usuniety.ts\0D  usuniety-staged.ts\0!! ignorowany.log\0 M zostaje.ts\0';
    expect(parseGitStatusPorcelainZ(output)).toEqual([{ path: 'zostaje.ts', state: 'modified' }]);
  });

  it('puste wyjście → pusta lista', () => {
    expect(parseGitStatusPorcelainZ('')).toEqual([]);
  });
});
