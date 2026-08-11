import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  hasGlobalSessionLogHooks,
  SESSION_LOG_SCRIPT,
  SESSION_LOG_SCRIPT_NAME,
  withGlobalSessionLogHooks,
} from '../shared/session-log-script';

/**
 * Globalny dziennik sesji (M53): instaluje samodzielny skrypt w katalogu
 * Claude Code i wpina go w hooki `~/.claude/settings.json`, dzięki czemu
 * dziennik powstaje też dla sesji uruchamianych poza Suflerem.
 */

function claudeDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude');
}

export function globalScriptPath(): string {
  return join(claudeDir(), SESSION_LOG_SCRIPT_NAME);
}

function settingsPath(): string {
  return join(claudeDir(), 'settings.json');
}

async function readSettings(): Promise<Record<string, unknown> | null> {
  try {
    const raw: unknown = JSON.parse(await readFile(settingsPath(), 'utf8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return null;
    }
    return raw as Record<string, unknown>;
  } catch (error) {
    // Brak pliku to poprawny stan wyjściowy; uszkodzonego JSON-a nie nadpisujemy.
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? {} : null;
  }
}

export async function isGlobalSessionLogEnabled(): Promise<boolean> {
  const settings = await readSettings();
  return settings !== null && hasGlobalSessionLogHooks(settings, globalScriptPath());
}

export type GlobalSessionLogResult =
  | { ok: true; enabled: boolean; path: string }
  | { ok: false; error: 'settings-unreadable' | 'write-failed' };

export async function setGlobalSessionLogEnabled(
  enabled: boolean,
): Promise<GlobalSessionLogResult> {
  const settings = await readSettings();
  if (settings === null) {
    return { ok: false, error: 'settings-unreadable' };
  }
  const script = globalScriptPath();
  try {
    await mkdir(claudeDir(), { recursive: true });
    if (enabled) {
      // Skrypt nadpisujemy przy każdym włączeniu — aktualizacja aplikacji
      // powinna odświeżyć też logikę dziennika.
      await writeFile(script, SESSION_LOG_SCRIPT, 'utf8');
      await chmod(script, 0o755);
    }
    const next = withGlobalSessionLogHooks(settings, script, enabled);
    await writeFile(settingsPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return { ok: true, enabled, path: script };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}
