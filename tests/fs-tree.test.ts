import { describe, expect, it } from 'vitest';
import { parseCheckIgnoreOutput, sortEntries } from '../src/main/fs-tree';

describe('parseCheckIgnoreOutput', () => {
  it('parsuje wyjście rozdzielone NUL-ami', () => {
    expect(parseCheckIgnoreOutput('node_modules/\0debug.log\0')).toEqual(
      new Set(['node_modules', 'debug.log']),
    );
  });

  it('zwraca pusty zbiór dla pustego wyjścia', () => {
    expect(parseCheckIgnoreOutput('')).toEqual(new Set());
  });

  it('zdejmuje końcowy ukośnik z katalogów', () => {
    expect(parseCheckIgnoreOutput('out/\0')).toEqual(new Set(['out']));
  });

  it('zachowuje nazwy ze spacjami i znakami specjalnymi', () => {
    expect(parseCheckIgnoreOutput('moje pliki/\0zażółć.txt\0')).toEqual(
      new Set(['moje pliki', 'zażółć.txt']),
    );
  });
});

describe('sortEntries', () => {
  it('sortuje katalogi przed plikami, alfabetycznie i numerycznie', () => {
    const sorted = sortEntries([
      { name: 'z.txt', kind: 'file' as const },
      { name: 'app', kind: 'dir' as const },
      { name: 'file10.ts', kind: 'file' as const },
      { name: 'file2.ts', kind: 'file' as const },
      { name: 'Bardzo', kind: 'dir' as const },
    ]);
    expect(sorted.map((entry) => entry.name)).toEqual([
      'app',
      'Bardzo',
      'file2.ts',
      'file10.ts',
      'z.txt',
    ]);
  });

  it('nie modyfikuje tablicy wejściowej', () => {
    const input = [
      { name: 'b', kind: 'file' as const },
      { name: 'a', kind: 'file' as const },
    ];
    sortEntries(input);
    expect(input.map((entry) => entry.name)).toEqual(['b', 'a']);
  });
});
