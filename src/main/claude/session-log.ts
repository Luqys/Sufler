import { BrowserWindow } from 'electron';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  buildSessionLogEntry,
  buildSessionLogHeader,
  parseSessionLogPayload,
  sessionLogFile,
  type SessionLogKind,
} from '../../shared/claude/session-log';
import { baseName } from '../../shared/editor/paths';
import { getProjectRoot } from '../project/project';
import { readState, writeState } from '../window/state-store';
import { createCheckpoint } from './checkpoints';
import { IPC } from '../../shared/ipc';

/**
 * Zapis dziennika sesji na dysk (M52). Plik powstaje przy pierwszym wpisie
 * danej sesji, kolejne wpisy są dopisywane. Awarie zapisu są połykane —
 * dziennik nie może przerwać pracy z Claude.
 */

/** Sesje, dla których nagłówek już powstał (w tym uruchomieniu aplikacji). */
const started = new Set<string>();

/**
 * Kolejka zapisów per plik. Hooki potrafią przyjść kilka naraz (polecenie,
 * edycja, komenda), a bez serializacji nagłówek pisany przez pierwsze
 * żądanie nadpisywał wpisy dopisane w tym czasie przez kolejne.
 */
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

export function isSessionLogEnabled(): boolean {
  return readState().sessionLog !== false;
}

export function setSessionLogEnabled(enabled: boolean): boolean {
  writeState({ ...readState(), sessionLog: enabled });
  return enabled;
}

async function currentBranch(root: string): Promise<string | null> {
  try {
    const head = await readFile(join(root, '.git', 'HEAD'), 'utf8');
    const match = /ref: refs\/heads\/(.+)/.exec(head.trim());
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Dopisuje zdarzenie hooka do dziennika bieżącego projektu.
 * Zwraca ścieżkę pliku albo null, gdy zdarzenie nic nie wnosi.
 */
export async function appendSessionLog(
  kind: SessionLogKind,
  rawBody: string,
  now = new Date(),
): Promise<string | null> {
  if (!isSessionLogEnabled()) {
    return null;
  }
  const root = getProjectRoot();
  if (!root) {
    return null;
  }
  const event = parseSessionLogPayload(kind, rawBody);
  if (!event) {
    return null;
  }
  const isoDate = now.toISOString();
  const relative = sessionLogFile(event.sessionId, isoDate);
  const absolute = join(root, relative);
  const time = isoDate.slice(11, 16);
  const entry = buildSessionLogEntry(event, time);
  if (!entry) {
    return null;
  }
  // Polecenie = początek tury Claude, czyli najlepszy moment na migawkę
  // drzewa: stan sprzed zmian, do którego można wrócić jednym kliknięciem.
  if (event.kind === 'prompt') {
    void createCheckpoint(root, event.prompt ?? '').then((hash) => {
      if (hash) {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC.CheckpointsChanged);
          }
        }
      }
    });
  }
  return enqueue(absolute, async () => {
    try {
      await mkdir(dirname(absolute), { recursive: true });
      if (!started.has(absolute)) {
        started.add(absolute);
        let exists = true;
        try {
          await readFile(absolute, 'utf8');
        } catch {
          exists = false;
        }
        if (!exists) {
          await writeFile(
            absolute,
            buildSessionLogHeader({
              sessionId: event.sessionId,
              isoDate,
              project: baseName(root),
              branch: await currentBranch(root),
            }),
            'utf8',
          );
          // Nowy plik w świeżo utworzonym katalogu bywa niewidoczny dla
          // chokidara (obserwacja katalogu rusza po jego powstaniu), więc panel
          // Wiedza dostaje sygnał wprost — inaczej dziennik pojawiłby się
          // dopiero przy kolejnej zmianie notatek.
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send(IPC.KnowledgeChanged);
            }
          }
        }
      }
      await appendFile(absolute, entry, 'utf8');
      return absolute;
    } catch {
      return null;
    }
  });
}
