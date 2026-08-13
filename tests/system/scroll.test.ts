import { describe, expect, it } from 'vitest';
import {
  ACCEL_WINDOW_MS,
  accelFor,
  classifyWheel,
  createWheelNormalizer,
  MAX_ACCEL,
  MAX_NOTCHES,
  MOUSE_STEP_LINES,
  notchesOf,
} from '../../src/shared/system/scroll';

const METRICS = { lineHeight: 20, viewport: 400 };

describe('classifyWheel', () => {
  it('drobne piksele to gładzik', () => {
    expect(classifyWheel({ deltaY: 4, deltaMode: 0, timeStamp: 0 })).toBe('trackpad');
    expect(classifyWheel({ deltaY: -12.5, deltaMode: 0, timeStamp: 0 })).toBe('trackpad');
  });

  it('gruba delta pikselowa to kółko myszy', () => {
    expect(classifyWheel({ deltaY: 100, deltaMode: 0, timeStamp: 0 })).toBe('mouse');
    expect(classifyWheel({ deltaY: -40, deltaMode: 0, timeStamp: 0 })).toBe('mouse');
  });

  it('delta w wierszach i stronach zawsze pochodzi od kółka', () => {
    expect(classifyWheel({ deltaY: 1, deltaMode: 1, timeStamp: 0 })).toBe('mouse');
    expect(classifyWheel({ deltaY: 1, deltaMode: 2, timeStamp: 0 })).toBe('mouse');
  });
});

describe('notchesOf', () => {
  it('typowa delta to jedno kliknięcie kółka', () => {
    expect(notchesOf(100)).toBe(1);
    expect(notchesOf(-100)).toBe(1);
    expect(notchesOf(40)).toBe(1);
  });

  it('gruba delta niesie kilka kliknięć, ale z górnym ograniczeniem', () => {
    expect(notchesOf(300)).toBe(3);
    expect(notchesOf(9000)).toBe(MAX_NOTCHES);
  });
});

describe('accelFor', () => {
  it('spokojne kręcenie nie przyspiesza', () => {
    expect(accelFor(Infinity)).toBe(1);
    expect(accelFor(ACCEL_WINDOW_MS)).toBe(1);
    expect(accelFor(ACCEL_WINDOW_MS + 50)).toBe(1);
  });

  it('szybkie kręcenie przyspiesza do granicy', () => {
    expect(accelFor(0)).toBeCloseTo(MAX_ACCEL);
    const middle = accelFor(ACCEL_WINDOW_MS / 2);
    expect(middle).toBeGreaterThan(1);
    expect(middle).toBeLessThan(MAX_ACCEL);
  });
});

describe('createWheelNormalizer', () => {
  it('gładzik przechodzi bez zmian — jego tempo to prędkość palca', () => {
    const normalizer = createWheelNormalizer();
    const result = normalizer.normalize({ deltaY: 7.5, deltaMode: 0, timeStamp: 10 }, METRICS);
    expect(result.device).toBe('trackpad');
    expect(result.pixels).toBe(7.5);
    expect(result.lines).toBeCloseTo(0.375);
  });

  it('jedno kliknięcie kółka to stały krok w wierszach', () => {
    const normalizer = createWheelNormalizer();
    const down = normalizer.normalize({ deltaY: 100, deltaMode: 0, timeStamp: 0 }, METRICS);
    expect(down.device).toBe('mouse');
    expect(down.lines).toBe(MOUSE_STEP_LINES);
    expect(down.pixels).toBe(MOUSE_STEP_LINES * METRICS.lineHeight);
  });

  it('to samo tempo w górę i w dół', () => {
    const normalizer = createWheelNormalizer();
    const down = normalizer.normalize({ deltaY: 100, deltaMode: 0, timeStamp: 0 }, METRICS);
    const up = normalizer.normalize({ deltaY: -100, deltaMode: 0, timeStamp: 1000 }, METRICS);
    expect(up.lines).toBe(-down.lines);
  });

  it('kolejne kliknięcia w odstępach nie przyspieszają', () => {
    const normalizer = createWheelNormalizer();
    const first = normalizer.normalize({ deltaY: 100, deltaMode: 0, timeStamp: 0 }, METRICS);
    const second = normalizer.normalize({ deltaY: 100, deltaMode: 0, timeStamp: 500 }, METRICS);
    expect(second.lines).toBe(first.lines);
  });

  it('szybka seria kliknięć przyspiesza przewijanie', () => {
    const normalizer = createWheelNormalizer();
    normalizer.normalize({ deltaY: 100, deltaMode: 0, timeStamp: 0 }, METRICS);
    const fast = normalizer.normalize({ deltaY: 100, deltaMode: 0, timeStamp: 20 }, METRICS);
    expect(fast.lines).toBeGreaterThan(MOUSE_STEP_LINES);
    expect(fast.lines).toBeLessThanOrEqual(MOUSE_STEP_LINES * MAX_ACCEL);
  });

  it('delta stronicowa przewija o widoczny obszar', () => {
    const normalizer = createWheelNormalizer();
    const result = normalizer.normalize({ deltaY: 1, deltaMode: 2, timeStamp: 0 }, METRICS);
    expect(result.pixels).toBe(METRICS.viewport);
  });

  it('delta w wierszach liczy się wierszami treści', () => {
    const normalizer = createWheelNormalizer();
    const result = normalizer.normalize({ deltaY: 2, deltaMode: 1, timeStamp: 0 }, METRICS);
    expect(result.lines).toBe(2 * MOUSE_STEP_LINES);
  });

  it('zerowa wysokość wiersza nie psuje wyniku', () => {
    const normalizer = createWheelNormalizer();
    const result = normalizer.normalize(
      { deltaY: 100, deltaMode: 0, timeStamp: 0 },
      { lineHeight: 0, viewport: 300 },
    );
    expect(Number.isFinite(result.pixels)).toBe(true);
    expect(result.pixels).toBeGreaterThan(0);
  });
});
