import { describe, expect, it } from 'vitest';
import { formatTokens, parseUsageLine, summarizeUsage, type UsageEntry } from '../src/shared/usage';

const NOW = Date.parse('2026-08-10T12:00:00Z');

function entry(daysAgo: number, output: number, model = 'claude-fable-5'): UsageEntry {
  return {
    timestamp: NOW - daysAgo * 24 * 60 * 60 * 1000,
    model,
    input: 10,
    output,
    cacheRead: 100,
    cacheCreate: 50,
  };
}

describe('parseUsageLine', () => {
  it('parsuje wpis assistant z usage (format rzeczywisty)', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-08-09T23:31:02.459Z',
      message: {
        model: 'claude-fable-5',
        usage: {
          input_tokens: 2,
          cache_creation_input_tokens: 7839,
          cache_read_input_tokens: 21349,
          output_tokens: 120,
        },
      },
    });
    expect(parseUsageLine(line)).toEqual({
      timestamp: Date.parse('2026-08-09T23:31:02.459Z'),
      model: 'claude-fable-5',
      input: 2,
      output: 120,
      cacheRead: 21349,
      cacheCreate: 7839,
    });
  });

  it('odrzuca inne wpisy i śmieci', () => {
    expect(parseUsageLine('{"type":"user","message":{}}')).toBeNull();
    expect(parseUsageLine('nie-json "assistant" "usage"')).toBeNull();
    expect(parseUsageLine('')).toBeNull();
  });
});

describe('summarizeUsage', () => {
  it('liczy okresy Dziś / 7 dni / 30 dni', () => {
    const summary = summarizeUsage(
      [entry(0.1, 500), entry(3, 200), entry(20, 100), entry(45, 999)],
      NOW,
      7,
    );
    const [today, week, month] = summary.periods;
    expect(today?.requests).toBe(1);
    expect(today?.output).toBe(500);
    expect(week?.requests).toBe(2);
    expect(week?.output).toBe(700);
    expect(month?.requests).toBe(3);
    expect(month?.output).toBe(800);
    expect(summary.scannedFiles).toBe(7);
  });

  it('ranking modeli po tokenach wyjściowych', () => {
    const summary = summarizeUsage(
      [entry(1, 100, 'haiku'), entry(2, 900, 'fable'), entry(3, 50, 'haiku')],
      NOW,
      1,
    );
    expect(summary.topModels[0]?.model).toBe('fable');
    expect(summary.topModels[1]).toEqual({ model: 'haiku', requests: 2, output: 150 });
  });
});

describe('formatTokens', () => {
  it('formatuje z polskim przecinkiem i skrótami', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1234)).toBe('1,2 tys.');
    expect(formatTokens(21349)).toBe('21,3 tys.');
    expect(formatTokens(5_600_000)).toBe('5,6 mln');
  });
});
