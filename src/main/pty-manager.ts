import type { BrowserWindow } from 'electron';
import { spawn, type IPty } from 'node-pty';
import { IPC, type PtyCreateResult } from '../shared/ipc';
import type { TabKind } from '../shared/dock-tabs';
import { resolveShellEnv } from './shell-env';

let nextPtyId = 1;
const sessions = new Map<number, IPty>();

/**
 * Kluczowa zasada ze SPEC.md: zakładki `terminal` i `claude` różnią się
 * WYŁĄCZNIE komendą startową pseudoterminala.
 */
export async function createPty(
  win: BrowserWindow,
  options: { kind: TabKind; cwd: string },
): Promise<PtyCreateResult> {
  const env = await resolveShellEnv();
  // Hak testowy (e2e): pozwala podstawić katalog z atrapą binarki `claude`.
  const prepend = process.env['VISUALN3O_PATH_PREPEND'];
  if (prepend) {
    env['PATH'] = `${prepend}:${env['PATH'] ?? ''}`;
  }
  const shell = env['SHELL'] || '/bin/zsh';
  const command = options.kind === 'claude' ? 'claude' : shell;
  try {
    const session = spawn(command, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: options.cwd,
      env,
    });
    const ptyId = nextPtyId++;
    sessions.set(ptyId, session);
    session.onData((data) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.PtyData, { ptyId, data });
      }
    });
    session.onExit(({ exitCode }) => {
      sessions.delete(ptyId);
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.PtyExit, { ptyId, exitCode });
      }
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
