import { describe, expect, it } from 'vitest';
import {
  nameWithSuffix,
  planImport,
  resolveCollision,
} from '../src/shared/import-drop';

describe('nameWithSuffix', () => {
  it('wstawia sufiks przed rozszerzeniem pliku', () => {
    expect(nameWithSuffix('raport.pdf', 2)).toBe('raport-2.pdf');
    expect(nameWithSuffix('archiwum.tar.gz', 3)).toBe('archiwum.tar-3.gz');
  });

  it('dotfile i nazwa bez rozszerzenia dostają sufiks na końcu', () => {
    expect(nameWithSuffix('.env', 2)).toBe('.env-2');
    expect(nameWithSuffix('zdjęcia', 2)).toBe('zdjęcia-2');
  });
});

describe('resolveCollision', () => {
  it('zostawia wolną nazwę bez zmian', () => {
    expect(resolveCollision('notatka.md', new Set(['inne.md']))).toBe('notatka.md');
  });

  it('szuka pierwszego wolnego sufiksu', () => {
    const taken = new Set(['notatka.md', 'notatka-2.md', 'notatka-3.md']);
    expect(resolveCollision('notatka.md', taken)).toBe('notatka-4.md');
  });
});

describe('planImport', () => {
  const root = '/projekt';

  it('planuje kopie i nadaje sufiksy względem zawartości katalogu', () => {
    const plan = planImport(
      ['/pulpit/materialy', '/pulpit/raport.pdf'],
      root,
      ['raport.pdf', 'src'],
    );
    expect(plan.skipped).toEqual([]);
    expect(plan.items).toEqual([
      { source: '/pulpit/materialy', targetName: 'materialy' },
      { source: '/pulpit/raport.pdf', targetName: 'raport-2.pdf' },
    ]);
  });

  it('dwa źródła o tej samej nazwie nie nadpisują się nawzajem', () => {
    const plan = planImport(
      ['/pulpit/notatka.md', '/dokumenty/notatka.md'],
      root,
      [],
    );
    expect(plan.items.map((item) => item.targetName)).toEqual([
      'notatka.md',
      'notatka-2.md',
    ]);
  });

  it('pomija źródła leżące w projekcie', () => {
    const plan = planImport([`${root}/src/app.ts`], root, []);
    expect(plan.items).toEqual([]);
    expect(plan.skipped).toEqual([{ name: 'app.ts', reason: 'inside-project' }]);
  });

  it('pomija projekt i jego katalogi nadrzędne', () => {
    const plan = planImport(['/', '/projekt', root], root, []);
    expect(plan.items).toEqual([]);
    expect(plan.skipped.map((skip) => skip.reason)).toEqual([
      'contains-project',
      'contains-project',
    ]);
  });

  it('ignoruje duplikaty tej samej ścieżki w jednym upuszczeniu', () => {
    const plan = planImport(
      ['/pulpit/raport.pdf', '/pulpit/raport.pdf'],
      root,
      [],
    );
    expect(plan.items).toHaveLength(1);
  });

  it('nie myli przedrostka nazwy z granicą katalogu', () => {
    const plan = planImport(['/projekt-obok/plik.txt'], root, []);
    expect(plan.items).toEqual([
      { source: '/projekt-obok/plik.txt', targetName: 'plik.txt' },
    ]);
  });
});
