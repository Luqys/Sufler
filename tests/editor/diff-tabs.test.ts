import { describe, expect, it } from 'vitest';
import {
  diffTabPath,
  diffTabTitle,
  isDiffPath,
  parseDiffPath,
  type DiffDescriptor,
} from '../../src/shared/editor/diff-tabs';

const LABELS = { worktreeSuffix: 'zmiany', ideDefault: 'Propozycja Claude' };

describe('pseudo-ścieżki diffów', () => {
  it('koduje i odczytuje deskryptor roboczy bez strat', () => {
    const descriptor: DiffDescriptor = { kind: 'worktree', path: 'src/app.ts' };
    const path = diffTabPath(descriptor);
    expect(isDiffPath(path)).toBe(true);
    expect(path.startsWith('vn3o://')).toBe(true);
    expect(parseDiffPath(path)).toEqual(descriptor);
  });

  it('koduje deskryptor commita z rodzicem i statusem', () => {
    const descriptor: DiffDescriptor = {
      kind: 'commit',
      hash: 'abcdef1234567890',
      parent: '1234567890abcdef',
      path: 'src/głęboki/plik z odstępem.tsx',
      status: 'M',
    };
    expect(parseDiffPath(diffTabPath(descriptor))).toEqual(descriptor);
  });

  it('koduje deskryptor propozycji ide', () => {
    const descriptor: DiffDescriptor = {
      kind: 'ide',
      requestId: 7,
      oldPath: '/proj/a.ts',
      newPath: '/proj/a.ts',
      tabName: 'Proponowane zmiany',
    };
    expect(parseDiffPath(diffTabPath(descriptor))).toEqual(descriptor);
  });

  it('odrzuca zwykłe ścieżki i uszkodzone deskryptory', () => {
    expect(isDiffPath('/zwykły/plik.ts')).toBe(false);
    expect(parseDiffPath('/zwykły/plik.ts')).toBeNull();
    expect(parseDiffPath('vn3o://diff/nie-json')).toBeNull();
    expect(parseDiffPath('vn3o://diff/' + encodeURIComponent('{"kind":"inny"}'))).toBeNull();
  });
});

describe('tytuły zakładek diffów', () => {
  it('roboczy: nazwa pliku z dopiskiem', () => {
    expect(diffTabTitle({ kind: 'worktree', path: 'src/app.ts' }, LABELS)).toBe(
      'app.ts • zmiany',
    );
  });

  it('commit: nazwa pliku i skrócony hash', () => {
    expect(
      diffTabTitle(
        { kind: 'commit', hash: 'abcdef1234567890', parent: null, path: 'x/y.css', status: 'A' },
        LABELS,
      ),
    ).toBe('y.css @ abcdef1');
  });

  it('ide: tab_name od CLI albo etykieta domyślna', () => {
    const base = { kind: 'ide' as const, requestId: 1, oldPath: '/a', newPath: '/a' };
    expect(diffTabTitle({ ...base, tabName: 'Moja zmiana' }, LABELS)).toBe('Moja zmiana');
    expect(diffTabTitle({ ...base, tabName: '' }, LABELS)).toBe('Propozycja Claude');
  });
});
