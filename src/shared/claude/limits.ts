/**
 * Prawdziwe limity planu Claude — te same liczby, które pokazuje /usage
 * w Claude Code (endpoint OAuth api.anthropic.com/api/oauth/usage).
 */

export type LimitSeverity = 'normal' | 'warning' | 'critical';

export interface UsageLimitEntry {
  /** Procent wykorzystania limitu (0–100). */
  percent: number;
  /** ISO czasu resetu okna albo null. */
  resetsAt: string | null;
  severity: LimitSeverity;
}

export interface UsageLimits {
  /** Bieżąca sesja (okno 5h). */
  session: UsageLimitEntry | null;
  /** Bieżący tydzień (wszystkie modele). */
  weekly: UsageLimitEntry | null;
}

export type UsageLimitsResult =
  | { ok: true; limits: UsageLimits }
  | {
      ok: false;
      error: string;
      /** Ostatnie znane wartości — pokazywane, gdy świeże pobranie zawiodło. */
      stale?: UsageLimits;
    };

const MIN_COOLDOWN_MS = 2 * 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;
const DEFAULT_COOLDOWN_MS = 5 * 60_000;

/**
 * Cisza po HTTP 429: szanuje nagłówek Retry-After (sekundy albo HTTP-date),
 * przycięta do [2 min, 15 min]; bez nagłówka lub przy śmieciach 5 min.
 */
export function rateLimitCooldownMs(retryAfter: string | null, now: number): number {
  const raw = retryAfter?.trim() ?? '';
  if (raw === '') {
    return DEFAULT_COOLDOWN_MS;
  }
  const seconds = Number(raw);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - now;
  if (Number.isNaN(ms)) {
    return DEFAULT_COOLDOWN_MS;
  }
  return Math.max(MIN_COOLDOWN_MS, Math.min(MAX_COOLDOWN_MS, ms));
}

interface RawBucket {
  utilization?: unknown;
  resets_at?: unknown;
}

interface RawLimitEntry {
  kind?: unknown;
  percent?: unknown;
  severity?: unknown;
  resets_at?: unknown;
}

function toSeverity(raw: unknown): LimitSeverity {
  return raw === 'warning' || raw === 'critical' ? raw : 'normal';
}

function fromBucket(raw: unknown): UsageLimitEntry | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const bucket = raw as RawBucket;
  if (typeof bucket.utilization !== 'number') {
    return null;
  }
  return {
    percent: Math.max(0, Math.min(100, Math.round(bucket.utilization))),
    resetsAt: typeof bucket.resets_at === 'string' ? bucket.resets_at : null,
    severity: 'normal',
  };
}

export function parseLimitsResponse(raw: unknown): UsageLimits {
  if (typeof raw !== 'object' || raw === null) {
    return { session: null, weekly: null };
  }
  const obj = raw as Record<string, unknown>;
  const session = fromBucket(obj['five_hour']);
  const weekly = fromBucket(obj['seven_day']);
  // Tablica limits[] doprecyzowuje severity (normal/warning/critical).
  if (Array.isArray(obj['limits'])) {
    for (const entry of obj['limits'] as RawLimitEntry[]) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }
      if (entry.kind === 'session' && session) {
        session.severity = toSeverity(entry.severity);
      }
      if (entry.kind === 'weekly_all' && weekly) {
        weekly.severity = toSeverity(entry.severity);
      }
    }
  }
  return { session, weekly };
}
