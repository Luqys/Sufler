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
  | { ok: false; error: string };

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
