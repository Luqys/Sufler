import { describe, expect, it } from 'vitest';
import {
  createUsageScanner,
  emptyTotals,
  lastDays,
  localDay,
  scanUsageLines,
  totalTokens,
} from '../../src/shared/claude/usage-history';

const reply = (stamp: string, usage: object, model = 'claude-opus-5'): string =>
  JSON.stringify({ type: 'assistant', timestamp: stamp, message: { model, usage } });

const LINES = [
  JSON.stringify({ type: 'user', timestamp: '2026-08-12T10:00:00.000Z', message: { content: 'hej' } }),
  reply('2026-08-12T10:00:20.000Z', {
    input_tokens: 10,
    output_tokens: 100,
    cache_creation_input_tokens: 1000,
    cache_read_input_tokens: 5000,
  }),
  reply('2026-08-12T23:30:00.000Z', { input_tokens: 5, output_tokens: 50 }, 'claude-haiku-4-5'),
  reply('2026-08-13T09:00:00.000Z', { input_tokens: 1, output_tokens: 7 }),
  '{"type":"assistant","message":{"usage":', // ucięta linia na końcu pliku
  '',
];

describe('createUsageScanner', () => {
  it('sumuje wszystkie rodzaje tokenów z odpowiedzi modelu', () => {
    const scan = scanUsageLines(LINES);
    expect(scan.totals).toEqual({
      input: 16,
      output: 157,
      cacheWrite: 1000,
      cacheRead: 5000,
      replies: 3,
    });
    expect(totalTokens(scan.totals)).toBe(6173);
  });

  it('pomija wpisy użytkownika, śmieci i ucięte linie', () => {
    const scan = scanUsageLines([
      JSON.stringify({ type: 'user', message: { usage: { output_tokens: 999 } } }),
      'nie-json',
      '',
      JSON.stringify({ type: 'assistant', message: {} }),
    ]);
    expect(scan.totals).toEqual(emptyTotals());
  });

  it('grupuje po dniach LOKALNYCH, od najnowszego', () => {
    // 23:30Z bywa już następnym dniem lokalnie — dlatego dat nie wpisujemy
    // na sztywno, tylko liczymy tak, jak zrobi to użytkownik w swojej strefie.
    const dni = ['2026-08-12T10:00:20.000Z', '2026-08-12T23:30:00.000Z', '2026-08-13T09:00:00.000Z']
      .map((iso) => localDay(iso) as string);
    const oczekiwane = [...new Set(dni)].sort((a, b) => (a < b ? 1 : -1));
    const scan = scanUsageLines(LINES);

    expect(scan.byDay.map((day) => day.date)).toEqual(oczekiwane);
    const licznik = new Map<string, number>();
    for (const dzień of dni) {
      licznik.set(dzień, (licznik.get(dzień) ?? 0) + 1);
    }
    for (const day of scan.byDay) {
      expect(day.totals.replies).toBe(licznik.get(day.date));
    }
  });

  it('grupuje po modelach, największy pierwszy', () => {
    const scan = scanUsageLines(LINES);
    expect(scan.byModel[0]?.model).toBe('claude-opus-5');
    expect(scan.byModel.map((entry) => entry.model)).toContain('claude-haiku-4-5');
  });

  it('skaner strumieniowy daje ten sam wynik co wsad', () => {
    const scanner = createUsageScanner();
    for (const line of LINES) {
      scanner.push(line);
    }
    expect(scanner.result().totals).toEqual(scanUsageLines(LINES).totals);
  });
});

describe('localDay', () => {
  it('zwraca datę lokalną, nie UTC', () => {
    const iso = '2026-08-12T23:30:00.000Z';
    const expected = new Date(Date.parse(iso));
    const month = `${expected.getMonth() + 1}`.padStart(2, '0');
    const day = `${expected.getDate()}`.padStart(2, '0');
    expect(localDay(iso)).toBe(`${expected.getFullYear()}-${month}-${day}`);
  });

  it('odrzuca śmieci', () => {
    expect(localDay('kiedyś')).toBeNull();
  });
});

describe('lastDays', () => {
  it('daje ciągły zakres dni z zerami w przerwach, od najstarszego', () => {
    const scan = scanUsageLines(LINES);
    const days = lastDays(scan, '2026-08-14T12:00:00.000Z', 4);
    const dzisiaj = localDay('2026-08-14T12:00:00.000Z') as string;

    expect(days).toHaveLength(4);
    expect(days.map((day) => day.date)).toEqual([...days].map((day) => day.date).sort());
    expect(days[3]?.date).toBe(dzisiaj);
    // Dzień bez ruchu ma zera, a dni z transkryptu zgadzają się ze skanem.
    expect(days[3]?.totals).toEqual(emptyTotals());
    for (const day of days) {
      const fromScan = scan.byDay.find((entry) => entry.date === day.date);
      expect(day.totals).toEqual(fromScan?.totals ?? emptyTotals());
    }
  });
});
