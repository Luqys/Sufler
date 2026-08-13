import { describe, expect, it } from 'vitest';
import {
  detachedQuery,
  isDetachablePanel,
  isOutsideWindow,
  parseDetachedTarget,
} from '../../src/shared/docks/detached';

const BOUNDS = { screenX: 100, screenY: 100, outerWidth: 800, outerHeight: 600 };

describe('parseDetachedTarget', () => {
  it('czyta panel i kartę edytora z adresu okna', () => {
    expect(parseDetachedTarget('?window=detached&kind=panel&target=git')).toMatchObject({
      kind: 'panel',
      target: 'git',
    });
    expect(
      parseDetachedTarget('?window=detached&kind=view&target=' + encodeURIComponent('src/app.ts')),
    ).toMatchObject({ kind: 'view', target: 'src/app.ts' });
  });

  it('odrzuca okno główne, nieznany panel i braki', () => {
    expect(parseDetachedTarget('')).toBeNull();
    expect(parseDetachedTarget('?window=terminal&ptyId=1')).toBeNull();
    expect(parseDetachedTarget('?window=detached&kind=panel&target=nieistnieje')).toBeNull();
    expect(parseDetachedTarget('?window=detached&kind=view')).toBeNull();
    expect(parseDetachedTarget('?window=detached&kind=cos&target=git')).toBeNull();
  });

  it('adres jest odwracalny', () => {
    const info = { kind: 'panel' as const, target: 'skills', title: 'Skille' };
    const query = new URLSearchParams(detachedQuery(info)).toString();
    expect(parseDetachedTarget(`?${query}`)).toMatchObject({ kind: 'panel', target: 'skills' });
  });
});

describe('isDetachablePanel', () => {
  it('zna panele boczne aplikacji', () => {
    expect(isDetachablePanel('files')).toBe(true);
    expect(isDetachablePanel('mcp')).toBe(true);
    expect(isDetachablePanel('cokolwiek')).toBe(false);
  });
});

describe('isOutsideWindow', () => {
  it('punkt w oknie i tuż przy krawędzi nie odrywa karty', () => {
    expect(isOutsideWindow({ screenX: 400, screenY: 300 }, BOUNDS)).toBe(false);
    expect(isOutsideWindow({ screenX: 920, screenY: 300 }, BOUNDS)).toBe(false);
  });

  it('punkt wyraźnie poza oknem odrywa', () => {
    expect(isOutsideWindow({ screenX: 1200, screenY: 300 }, BOUNDS)).toBe(true);
    expect(isOutsideWindow({ screenX: 400, screenY: 20 }, BOUNDS)).toBe(true);
    expect(isOutsideWindow({ screenX: 5, screenY: 300 }, BOUNDS)).toBe(true);
  });

  it('wyzerowane współrzędne (anulowane przeciąganie) nie odrywają', () => {
    expect(isOutsideWindow({ screenX: 0, screenY: 0 }, BOUNDS)).toBe(false);
  });
});
