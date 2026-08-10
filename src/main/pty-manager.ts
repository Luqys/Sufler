import { BrowserWindow } from 'electron';
import { spawn, type IPty } from 'node-pty';
import { IPC, type PtyCreateResult } from '../shared/ipc';
import type { TabKind } from '../shared/dock-tabs';
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
export async function createPty(
  options: { kind: TabKind; cwd: string; args?: string[] },
): Promise<PtyCreateResult> {
  const env = await resolveShellEnv();
  const shell = env['SHELL'] || '/bin/zsh';
  const command = options.kind === 'claude' ? 'claude' : shell;
  try {
    const session = spawn(command, options.args ?? [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: options.cwd,
      env,
    });
    const ptyId = nextPtyId++;
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
      title: options.kind === 'claude' ? 'Claude' : (shell.split('/').pop() ?? 'shell'),
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
