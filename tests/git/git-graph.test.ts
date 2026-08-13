import { describe, expect, it } from 'vitest';
import { assignLanes, maxLaneCount } from '../../src/shared/git/git-graph';

describe('assignLanes', () => {
  it('liniowa historia zostaje w jednej kolumnie', () => {
    const rows = assignLanes([
      { hash: 'c3', parents: ['c2'] },
      { hash: 'c2', parents: ['c1'] },
      { hash: 'c1', parents: [] },
    ]);
    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(maxLaneCount(rows)).toBe(1);
    // Środkowy commit ma linię z góry i w dół.
    expect(rows[1]?.before[0]).toBe('c2');
    expect(rows[1]?.after[0]).toBe('c1');
    // Korzeń nie ciągnie linii w dół.
    expect(rows[2]?.after).toEqual([]);
  });

  it('merge otwiera drugą kolumnę dla drugiego rodzica i zwija ją przy bazie', () => {
    // m ─ merge(f, b); f ─ feature od a; b ─ commit na gałęzi; a ─ wspólna baza.
    const rows = assignLanes([
      { hash: 'm', parents: ['f', 'b'] },
      { hash: 'f', parents: ['a'] },
      { hash: 'b', parents: ['a'] },
      { hash: 'a', parents: [] },
    ]);
    expect(rows[0]?.lane).toBe(0);
    expect(rows[0]?.after).toEqual(['f', 'b']);
    expect(rows[1]?.lane).toBe(0);
    expect(rows[2]?.lane).toBe(1);
    // Po bazie 'a' obie kolumny czekają na 'a'; commit 'a' zwija drugą kolumnę.
    expect(rows[2]?.after).toEqual(['a', 'a']);
    expect(rows[3]?.lane).toBe(0);
    expect(rows[3]?.after).toEqual([]);
    expect(maxLaneCount(rows)).toBe(2);
  });

  it('nowa głowa gałęzi bez oczekującej kolumny dostaje wolny slot', () => {
    const rows = assignLanes([
      { hash: 'x', parents: [] },
      { hash: 'y', parents: [] },
    ]);
    expect(rows[0]?.lane).toBe(0);
    expect(rows[1]?.lane).toBe(0); // kolumna zwolniona po korzeniu bez rodzica
  });
});
