import { describe, expect, it } from 'vitest';
import { filterPaths, fuzzyMatch } from '../../src/shared/system/fuzzy';

describe('fuzzyMatch', () => {
  it('dopasowuje podciąg bez rozróżniania wielkości liter', () => {
    expect(fuzzyMatch('app', 'src/App.ts')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'src/app.ts')).toBeNull();
  });

  it('zwraca pozycje trafionych znaków', () => {
    const match = fuzzyMatch('app', 'src/app.ts');
    expect(match?.positions).toEqual([4, 5, 6]);
  });

  it('puste zapytanie pasuje wszędzie z zerowym wynikiem', () => {
    expect(fuzzyMatch('', 'cokolwiek.ts')?.positions).toEqual([]);
  });
});

describe('filterPaths', () => {
  const files = [
    'docs/appendix.md',
    'src/app.ts',
    'src/components/AppHeader.tsx',
    'tests/app.test.ts',
    'package.json',
  ];

  it('plik o nazwie zaczynającej się od zapytania wygrywa', () => {
    const [first] = filterPaths(files, 'app');
    expect(first?.path).toBe('src/app.ts');
  });

  it('odfiltrowuje niepasujące i tnie do limitu', () => {
    expect(filterPaths(files, 'app', 2)).toHaveLength(2);
    expect(filterPaths(files, 'package').map((match) => match.path)).toEqual([
      'package.json',
    ]);
  });

  it('puste zapytanie zwraca początek listy', () => {
    expect(filterPaths(files, '', 3)).toHaveLength(3);
  });

  it('premiuje początek nazwy pliku nad trafienie w środku', () => {
    const paths = ['acdz.ts', 'x/cd.ts'];
    const [first] = filterPaths(paths, 'cd');
    expect(first?.path).toBe('x/cd.ts');
  });
});
