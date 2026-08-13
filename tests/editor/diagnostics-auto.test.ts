import { describe, expect, it } from 'vitest';
import {
  AUTO_DEBOUNCE_MS,
  AUTO_MIN_GAP_MS,
  autoRunDelay,
  filterDiagnostics,
} from '../../src/shared/editor/diagnostics-auto';
import type { Diagnostic } from '../../src/shared/editor/diagnostics';

const ITEMS: Diagnostic[] = [
  {
    file: 'src/main/index.ts',
    line: 294,
    column: 65,
    severity: 'error',
    message: "Cannot find name 'HookLayer'.",
    source: 'tsc',
    code: 'TS2304',
  },
  {
    file: 'src/renderer/gałąź.tsx',
    line: 12,
    column: 7,
    severity: 'warning',
    message: 'Nieużywana zmienna',
    source: 'eslint',
    code: 'no-unused-vars',
  },
  {
    file: 'src/shared/limits.ts',
    line: 5,
    column: 1,
    severity: 'warning',
    message: 'Expected === and instead saw ==',
    source: 'eslint',
    code: 'eqeqeq',
  },
];

const NOW = 1_000_000;

describe('autoRunDelay', () => {
  it('tryb wyłączony nie uruchamia niczego', () => {
    expect(autoRunDelay({ lastFinishedMs: 0, running: false }, false, NOW)).toBeNull();
  });

  it('trwający przebieg nie dokłada kolejki — wynik i tak będzie świeży', () => {
    expect(autoRunDelay({ lastFinishedMs: 0, running: true }, true, NOW)).toBeNull();
  });

  it('pierwszy zapis czeka tylko na przerwę w serii', () => {
    expect(autoRunDelay({ lastFinishedMs: 0, running: false }, true, NOW)).toBe(AUTO_DEBOUNCE_MS);
  });

  it('zapis długo po poprzednim przebiegu też czeka tylko na przerwę', () => {
    const state = { lastFinishedMs: NOW - 60_000, running: false };
    expect(autoRunDelay(state, true, NOW)).toBe(AUTO_DEBOUNCE_MS);
  });

  it('zapis tuż po przebiegu czeka do końca okna odstępu', () => {
    const state = { lastFinishedMs: NOW - 1_000, running: false };
    expect(autoRunDelay(state, true, NOW)).toBe(AUTO_MIN_GAP_MS - 1_000);
  });

  it('odstęp nigdy nie skraca zwłoki poniżej przerwy w serii', () => {
    const state = { lastFinishedMs: NOW - (AUTO_MIN_GAP_MS - 200), running: false };
    expect(autoRunDelay(state, true, NOW)).toBe(AUTO_DEBOUNCE_MS);
  });
});

describe('filterDiagnostics', () => {
  it('pusta fraza przepuszcza wszystko', () => {
    expect(filterDiagnostics(ITEMS, '   ')).toHaveLength(3);
  });

  it('szuka po ścieżce, treści i kodzie reguły', () => {
    expect(filterDiagnostics(ITEMS, 'index.ts')).toHaveLength(1);
    expect(filterDiagnostics(ITEMS, 'nieużywana')).toHaveLength(1);
    expect(filterDiagnostics(ITEMS, 'eqeqeq')).toHaveLength(1);
  });

  it('ignoruje ogonki i wielkość liter', () => {
    expect(filterDiagnostics(ITEMS, 'GALAZ')).toHaveLength(1);
  });

  it('zawężenie do błędów odsiewa ostrzeżenia', () => {
    const errors = filterDiagnostics(ITEMS, '', 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('TS2304');
  });

  it('fraza i poziom działają razem', () => {
    expect(filterDiagnostics(ITEMS, 'src', 'error')).toHaveLength(1);
    expect(filterDiagnostics(ITEMS, 'eqeqeq', 'error')).toHaveLength(0);
  });
});
