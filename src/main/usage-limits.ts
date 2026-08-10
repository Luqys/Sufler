import { execFile } from 'node:child_process';
import { t, tf } from './i18n';
import { promisify } from 'node:util';
import {
  parseLimitsResponse,
  rateLimitCooldownMs,
  type UsageLimits,
  type UsageLimitsResult,
} from '../shared/limits';

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const CACHE_TTL_MS = 60_000;

let cache: { at: number; result: UsageLimitsResult } | null = null;
/** Ostatnie poprawne limity — fallback, gdy odświeżenie zawiedzie. */
let lastGood: UsageLimits | null = null;
/** Do tego czasu nie odpytujemy endpointu po HTTP 429 (nawet z force). */
let quietUntil = 0;

function failure(error: string): UsageLimitsResult {
  return lastGood ? { ok: false, error, stale: lastGood } : { ok: false, error };
}

/** Token OAuth z Keychain (ten sam, którego używa Claude Code). Nigdy nie logowany. */
async function readAccessToken(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'],
      { timeout: 15_000, maxBuffer: 1024 * 1024, encoding: 'utf8' },
    );
    const parsed = JSON.parse(stdout.trim()) as {
      claudeAiOauth?: { accessToken?: unknown };
    };
    const token = parsed.claudeAiOauth?.accessToken;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Limity planu jak w /usage Claude Code. Hak testowy: VISUALN3O_LIMITS_JSON
 * ('off' wyłącza, inaczej JSON odpowiedzi endpointu).
 */
export async function getUsageLimits(force = false): Promise<UsageLimitsResult> {
  const override = process.env['VISUALN3O_LIMITS_JSON'];
  if (override) {
    if (override === 'off') {
      return { ok: false, error: 'wyłączone w testach' };
    }
    // Symulacja odpowiedzi HTTP w testach: 'status:<kod>'.
    if (override.startsWith('status:')) {
      const status = Number(override.slice('status:'.length));
      return status === 429
        ? { ok: false, error: tf('main.usageRateLimited', { minutes: 5 }) }
        : { ok: false, error: tf('main.usageHttp', { status }) };
    }
    try {
      return { ok: true, limits: parseLimitsResponse(JSON.parse(override)) };
    } catch {
      return { ok: false, error: 'niepoprawny VISUALN3O_LIMITS_JSON' };
    }
  }

  const now = Date.now();
  // Cisza po 429 obowiązuje także ręczne odświeżenie — endpoint prosił o przerwę.
  if (now < quietUntil && cache) {
    return cache.result;
  }
  if (!force && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.result;
  }

  let result: UsageLimitsResult;
  const token = await readAccessToken();
  if (!token) {
    result = failure(t('main.usageNoToken'));
  } else {
    try {
      const response = await fetch(USAGE_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': 'oauth-2025-04-20',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 429) {
        const cooldown = rateLimitCooldownMs(response.headers.get('retry-after'), now);
        quietUntil = now + cooldown;
        result = failure(
          tf('main.usageRateLimited', { minutes: Math.max(1, Math.round(cooldown / 60_000)) }),
        );
      } else if (!response.ok) {
        result = failure(
          response.status === 401
            ? t('main.usageExpired')
            : tf('main.usageHttp', { status: response.status }),
        );
      } else {
        const limits = parseLimitsResponse(await response.json());
        lastGood = limits;
        result = { ok: true, limits };
      }
    } catch (error) {
      result = failure(tf('main.usageFetchFailed', { error: String(error) }));
    }
  }
  cache = { at: now, result };
  return result;
}
