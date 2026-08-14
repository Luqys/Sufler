import { describe, expect, it } from 'vitest';
import {
  findMatches,
  initialMatch,
  scrollTargetLine,
  stepMatch,
} from '../../src/shared/docks/terminal-search';

const LINES = [
  'npm run build',
  'Error: brak modułu ws',
  'ponawiam build — error w innym miejscu',
  '',
  'gotowe',
];

describe('findMatches', () => {
  it('znajduje bez względu na wielkość liter', () => {
    expect(findMatches(LINES, 'error')).toEqual([
      { line: 1, column: 0, length: 5 },
      { line: 2, column: 17, length: 5 },
    ]);
  });

  it('kilka trafień w jednym wierszu liczy się osobno', () => {
    expect(findMatches(['ala ma ala ma ala'], 'ala')).toHaveLength(3);
  });

  it('puste zapytanie nic nie znajduje', () => {
    expect(findMatches(LINES, '')).toEqual([]);
    expect(findMatches(LINES, '   ')).toEqual([]);
  });

  it('fraza spoza bufora daje pustkę', () => {
    expect(findMatches(LINES, 'supabase')).toEqual([]);
  });
});

describe('stepMatch', () => {
  it('zawija się w obie strony', () => {
    expect(stepMatch(3, 2, 1)).toBe(0);
    expect(stepMatch(3, 0, -1)).toBe(2);
  });

  it('bez trafień nie ma dokąd iść', () => {
    expect(stepMatch(0, -1, 1)).toBe(-1);
  });

  it('pierwszy krok zależy od kierunku', () => {
    expect(stepMatch(4, -1, 1)).toBe(0);
    expect(stepMatch(4, -1, -1)).toBe(3);
  });
});

describe('initialMatch', () => {
  it('zaczynamy od ostatniego trafienia — rozmowa toczy się w dół', () => {
    expect(initialMatch(findMatches(LINES, 'error'))).toBe(1);
    expect(initialMatch([])).toBe(-1);
  });
});

describe('scrollTargetLine', () => {
  it('trafienie ląduje w połowie ekranu', () => {
    expect(scrollTargetLine(100, 40)).toBe(80);
  });

  it('przy górnej krawędzi nie schodzimy poniżej zera', () => {
    expect(scrollTargetLine(3, 40)).toBe(0);
  });
});
