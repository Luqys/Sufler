import { describe, expect, it } from 'vitest';
import {
  activeDesk,
  addDesk,
  cycleDesk,
  deskAt,
  deskName,
  initialDesks,
  removeDesk,
  restoreDesks,
} from '../../src/shared/project/desks';

const A = '/Users/kto/praca/sklep';
const B = '/Users/kto/Desktop/VisualN3O';
const C = '/opt/notatki';

describe('deskName', () => {
  it('nazwa biurka to ostatni element ścieżki', () => {
    expect(deskName(A)).toBe('sklep');
    expect(deskName('/opt/repo/')).toBe('repo');
  });
});

describe('initialDesks', () => {
  it('start to jedno biurko, od razu aktywne', () => {
    const state = initialDesks(A);
    expect(state.desks).toHaveLength(1);
    expect(activeDesk(state)?.root).toBe(A);
  });
});

describe('addDesk', () => {
  it('dokłada biurko i czyni je aktywnym', () => {
    const state = addDesk(initialDesks(A), B);
    expect(state.desks.map((desk) => desk.root)).toEqual([A, B]);
    expect(activeDesk(state)?.root).toBe(B);
  });

  it('projekt już otwarty NIE tworzy drugiego biurka, tylko przełącza', () => {
    const dwa = addDesk(initialDesks(A), B);
    const znowu = addDesk(dwa, A);
    expect(znowu.desks).toHaveLength(2);
    expect(activeDesk(znowu)?.root).toBe(A);
  });

  it('końcowy ukośnik to ta sama ścieżka', () => {
    const state = addDesk(initialDesks(A), `${A}/`);
    expect(state.desks).toHaveLength(1);
  });

  it('identyfikatory są unikalne mimo tej samej nazwy katalogu', () => {
    const state = addDesk(initialDesks('/praca/api'), '/prywatne/api');
    expect(new Set(state.desks.map((desk) => desk.id)).size).toBe(2);
  });
});

describe('removeDesk', () => {
  it('ostatniego biurka nie da się zamknąć', () => {
    const jedno = initialDesks(A);
    expect(removeDesk(jedno, jedno.activeId)).toEqual(jedno);
  });

  it('zamknięcie aktywnego przechodzi na sąsiada z lewej', () => {
    const trzy = addDesk(addDesk(initialDesks(A), B), C);
    const bezOstatniego = removeDesk(trzy, trzy.activeId);
    expect(bezOstatniego.desks.map((desk) => desk.root)).toEqual([A, B]);
    expect(activeDesk(bezOstatniego)?.root).toBe(B);
  });

  it('zamknięcie nieaktywnego nie zmienia aktywnego', () => {
    const trzy = addDesk(addDesk(initialDesks(A), B), C);
    const bezPierwszego = removeDesk(trzy, trzy.desks[0]!.id);
    expect(activeDesk(bezPierwszego)?.root).toBe(C);
  });

  it('nieznane id nic nie zmienia', () => {
    const dwa = addDesk(initialDesks(A), B);
    expect(removeDesk(dwa, 'nie-ma')).toEqual(dwa);
  });
});

describe('deskAt / cycleDesk', () => {
  const trzy = addDesk(addDesk(initialDesks(A), B), C);

  it('numer biurka liczy się od jedynki (Cmd+1…9)', () => {
    expect(deskAt(trzy, 1)?.root).toBe(A);
    expect(deskAt(trzy, 3)?.root).toBe(C);
    expect(deskAt(trzy, 4)).toBeNull();
  });

  it('cykl zawija się w obie strony', () => {
    const naOstatnim = { ...trzy, activeId: trzy.desks[2]!.id };
    expect(cycleDesk(naOstatnim, 1)).toBe(trzy.desks[0]!.id);
    const naPierwszym = { ...trzy, activeId: trzy.desks[0]!.id };
    expect(cycleDesk(naPierwszym, -1)).toBe(trzy.desks[2]!.id);
  });
});

describe('restoreDesks', () => {
  it('odtwarza biurka i aktywne z zapisanych ścieżek', () => {
    const state = restoreDesks([A, B], B);
    expect(state?.desks.map((desk) => desk.root)).toEqual([A, B]);
    expect(activeDesk(state!)?.root).toBe(B);
  });

  it('odsiewa duplikaty i puste wpisy', () => {
    const state = restoreDesks([A, `${A}/`, '', B], null);
    expect(state?.desks.map((desk) => desk.root)).toEqual([A, B]);
  });

  it('nieznane aktywne wraca na pierwsze biurko', () => {
    expect(activeDesk(restoreDesks([A, B], '/nie/ma')!)?.root).toBe(A);
  });

  it('pusty zapis to brak stanu — wołający robi biurko od zera', () => {
    expect(restoreDesks([], null)).toBeNull();
  });
});
