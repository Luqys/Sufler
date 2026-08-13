import { BrowserWindow } from 'electron';
import { statSync } from 'node:fs';
import { spawn, type IPty } from 'node-pty';
import { IPC, type PtyCreateResult } from '../shared/ipc';
import type { TabKind } from '../shared/dock-tabs';
import {
  defaultShell,
  executableCandidates,
  shellTitle,
  spawnPlanFor,
  type Platform,
} from '../shared/exec-path';
import { t, tf } from './i18n';
import { ideEnvForClaude, ideHookSettingsArgs } from './ide-server';
import { resolveShellEnv } from './shell-env';

let nextPtyId = 1;
const sessions = new Map<number, IPty>();

/** Dane pty lecą do WSZYSTKICH okien (główne + odczepione terminale). */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

/**
 * Kluczowa zasada ze SPEC.md: zakładki `terminal` i `claude` różnią się
 * WYŁĄCZNIE komendą startową pseudoterminala.
 */
const PLATFORM: Platform = process.platform === 'win32' ? 'win32' : 'posix';

/** Pierwszy istniejący plik z listy kandydatów (PATH × PATHEXT). */
function resolveExecutable(
  command: string,
  env: Record<string, string | undefined>,
): string | null {
  for (const candidate of executableCandidates(command, env, PLATFORM)) {
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Kandydat nie istnieje — próbujemy dalej.
    }
  }
  return null;
}

export async function createPty(
  options: { kind: TabKind; cwd: string; args?: string[] },
): Promise<PtyCreateResult> {
  const env = { ...(await resolveShellEnv()) };
  const shell = defaultShell(env, PLATFORM);
  const wanted = options.kind === 'claude' ? 'claude' : shell;
  const ptyId = nextPtyId++;
  let args = options.args ?? [];
  if (options.kind === 'claude') {
    // CLI znajdzie nasz serwer „ide" (diffy w Monaco, podgląd zaznaczenia),
    // a hooki Notification/Stop z --settings odeślą deterministyczny status
    // karty (VISUALN3O_TAB_ID rozwiązuje shell komendy hooka). --settings
    // na końcu — argumenty pozycyjne wołających (np. /login) muszą zostać $1.
    Object.assign(env, await ideEnvForClaude(), { VISUALN3O_TAB_ID: String(ptyId) });
    args = [...args, ...ideHookSettingsArgs()];
  }
  // Rozwiązanie nazwy PRZED spawnem: node-pty zwraca wtedy „File not found"
  // bez wskazówki, czego brakuje. Na Windowsie dochodzi PATHEXT i to, że
  // `claude` jest plikiem wsadowym (`claude.cmd`), którego nie da się
  // uruchomić bez `cmd.exe` (zgłoszenie z Windowsa, M78).
  const resolved = resolveExecutable(wanted, env);
  if (!resolved) {
    return {
      ok: false,
      error:
        options.kind === 'claude'
          ? t('main.claudeMissing')
          : tf('main.shellMissing', { shell: wanted }),
    };
  }
  const plan = spawnPlanFor(resolved, args, env, PLATFORM);
  try {
    const session = spawn(plan.command, plan.args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: options.cwd,
      env,
    });
    sessions.set(ptyId, session);
    session.onData((data) => {
      broadcast(IPC.PtyData, { ptyId, data });
    });
    session.onExit(({ exitCode }) => {
      sessions.delete(ptyId);
      broadcast(IPC.PtyExit, { ptyId, exitCode });
    });
    return {
      ok: true,
      ptyId,
      pid: session.pid,
      title: options.kind === 'claude' ? 'Claude' : shellTitle(shell),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function writePty(ptyId: number, data: string): void {
  sessions.get(ptyId)?.write(data);
}

export function resizePty(ptyId: number, cols: number, rows: number): void {
  if (cols > 0 && rows > 0) {
    sessions.get(ptyId)?.resize(cols, rows);
  }
}

export function killPty(ptyId: number): void {
  sessions.get(ptyId)?.kill();
  sessions.delete(ptyId);
}

/** Ryzyko nr 2 ze SPEC.md: żadnych osieroconych pty przy zamykaniu aplikacji. */
export function killAllPtys(): void {
  for (const session of sessions.values()) {
    session.kill();
  }
  sessions.clear();
}

export function listPtyPids(): number[] {
  return [...sessions.values()].map((session) => session.pid);
}
