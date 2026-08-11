import { describe, expect, it } from 'vitest';
import {
  forecastExhaustion,
  formatDuration,
  MAX_SAMPLES,
  pushSample,
  shouldWarn,
} from '../src/shared/limits-forecast';

const T0 = Date.parse('2026-08-11T10:00:00Z');
const MIN = 60_000;

describe('pushSample', () => {
  it('dokłada pomiar i przycina historię do limitu', () => {
    let samples = [] as ReturnType<typeof pushSample>;
    for (let i = 0; i < MAX_SAMPLES + 10; i += 1) {
      samples = pushSample(samples, { at: T0 + i * MIN, percent: i });
    }
    expect(samples).toHaveLength(MAX_SAMPLES);
    expect(samples[samples.length - 1]?.percent).toBe(MAX_SAMPLES + 9);
  });

  it('spadek zużycia (reset okna) zaczyna historię od nowa', () => {
    const samples = pushSample(
      [
        { at: T0, percent: 70 },
        { at: T0 + MIN, percent: 90 },
      ],
      { at: T0 + 2 * MIN, percent: 4 },
    );
    expect(samples).toEqual([{ at: T0 + 2 * MIN, percent: 4 }]);
  });
});

describe('forecastExhaustion', () => {
  it('liczy czas do 100% z tempa wzrostu', () => {
    // 20 punktów w 10 minut → 2 pkt/min, zostało 40 pkt → 20 minut.
    const ms = forecastExhaustion([
      { at: T0, percent: 40 },
      { at: T0 + 10 * MIN, percent: 60 },
    ]);
    expect(ms).toBe(20 * MIN);
  });

  it('bez wzrostu, przy jednym pomiarze i po wyczerpaniu limitu brak prognozy', () => {
    expect(forecastExhaustion([{ at: T0, percent: 50 }])).toBeNull();
    expect(
      forecastExhaustion([
        { at: T0, percent: 50 },
        { at: T0 + 10 * MIN, percent: 50 },
      ]),
    ).toBeNull();
    expect(
      forecastExhaustion([
        { at: T0, percent: 99 },
        { at: T0 + 10 * MIN, percent: 100 },
      ]),
    ).toBeNull();
  });

  it('zbyt krótka obserwacja nie wystarcza na prognozę', () => {
    expect(
      forecastExhaustion([
        { at: T0, percent: 10 },
        { at: T0 + 30_000, percent: 20 },
      ]),
    ).toBeNull();
  });
});

describe('shouldWarn', () => {
  it('ostrzega po przekroczeniu progu tylko raz na okno', () => {
    expect(shouldWarn(79, null)).toBe(false);
    expect(shouldWarn(80, null)).toBe(true);
    expect(shouldWarn(92, 80)).toBe(false);
  });

  it('po resecie okna ostrzeżenie wraca', () => {
    expect(shouldWarn(85, 95)).toBe(true);
  });
});

describe('formatDuration', () => {
  it('rozbija czas na godziny i minuty', () => {
    expect(formatDuration(25 * MIN)).toEqual({ hours: 0, minutes: 25 });
    expect(formatDuration(80 * MIN)).toEqual({ hours: 1, minutes: 20 });
    expect(formatDuration(-5)).toEqual({ hours: 0, minutes: 0 });
  });
});
