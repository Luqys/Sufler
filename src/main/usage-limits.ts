import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseLimitsResponse, type UsageLimitsResult } from '../shared/limits';

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const CACHE_TTL_MS = 60_000;

let cache: { at: number; result: UsageLimitsResult } | null = null;

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
    try {
      return { ok: true, limits: parseLimitsResponse(JSON.parse(override)) };
    } catch {
      return { ok: false, error: 'niepoprawny VISUALN3O_LIMITS_JSON' };
    }
  }

  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.result;
  }

  let result: UsageLimitsResult;
  const token = await readAccessToken();
  if (!token) {
    result = { ok: false, error: 'Brak tokenu Claude Code w Keychain — zaloguj się (✳).' };
  } else {
    try {
      const response = await fetch(USAGE_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': 'oauth-2025-04-20',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        result = {
          ok: false,
          error:
            response.status === 401
              ? 'Token wygasł — odśwież logowanie w Claude Code (✳).'
              : `Endpoint limitów odpowiedział HTTP ${response.status}.`,
        };
      } else {
        result = { ok: true, limits: parseLimitsResponse(await response.json()) };
      }
    } catch (error) {
      result = { ok: false, error: `Nie udało się pobrać limitów: ${String(error)}` };
    }
  }
  cache = { at: now, result };
  return result;
}
