import { describe, expect, it } from 'vitest';
import { parseLimitsResponse } from '../src/shared/limits';

/** Fixture przechwycony z rzeczywistego api/oauth/usage (sierpień 2026, wycinek). */
const REAL_RESPONSE = {
  five_hour: {
    utilization: 17,
    resets_at: '2026-08-10T12:50:00.706241+00:00',
    limit_dollars: null,
  },
  seven_day: {
    utilization: 8,
    resets_at: '2026-08-16T09:00:00.706266+00:00',
  },
  seven_day_opus: null,
  limits: [
    {
      kind: 'session',
      group: 'session',
      percent: 17,
      severity: 'normal',
      resets_at: '2026-08-10T12:50:00.706241+00:00',
      is_active: true,
    },
    {
      kind: 'weekly_all',
      group: 'weekly',
      percent: 8,
      severity: 'warning',
      resets_at: '2026-08-16T09:00:00.706266+00:00',
      is_active: false,
    },
  ],
};

describe('parseLimitsResponse', () => {
  it('mapuje five_hour/seven_day z severity z tablicy limits', () => {
    const limits = parseLimitsResponse(REAL_RESPONSE);
    expect(limits.session).toEqual({
      percent: 17,
      resetsAt: '2026-08-10T12:50:00.706241+00:00',
      severity: 'normal',
    });
    expect(limits.weekly?.percent).toBe(8);
    expect(limits.weekly?.severity).toBe('warning');
  });

  it('zaokrągla i przycina procenty do 0–100', () => {
    const limits = parseLimitsResponse({
      five_hour: { utilization: 137.6, resets_at: null },
      seven_day: { utilization: -3, resets_at: null },
    });
    expect(limits.session?.percent).toBe(100);
    expect(limits.weekly?.percent).toBe(0);
  });

  it('braki i śmieci → null', () => {
    expect(parseLimitsResponse(null)).toEqual({ session: null, weekly: null });
    expect(parseLimitsResponse({ five_hour: { utilization: 'x' } }).session).toBeNull();
    expect(parseLimitsResponse({}).weekly).toBeNull();
  });
});
