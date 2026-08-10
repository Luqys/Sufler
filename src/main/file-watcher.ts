import { watch, type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import { IPC, type WatchEvent } from '../shared/ipc';

let watcher: FSWatcher | null = null;
const watched = new Set<string>();

/**
 * Deklaratywna lista obserwowanych plików (otwarte zakładki edytora).
 * Obserwujemy wyłącznie pojedyncze pliki, nigdy katalogi rekurencyjnie —
 * patrz „Znane ryzyka" w SPEC.md.
 */
export function setWatchedFiles(win: BrowserWindow, paths: string[]): void {
  if (!watcher) {
    watcher = watch([], {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });
    const send = (kind: WatchEvent['kind']) => (path: string) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.WatchEvent, { path, kind } satisfies WatchEvent);
      }
    };
    watcher.on('change', send('changed'));
    watcher.on('add', send('changed'));
    watcher.on('unlink', send('deleted'));
  }
  const next = new Set(paths);
  for (const path of watched) {
    if (!next.has(path)) {
      void watcher.unwatch(path);
      watched.delete(path);
    }
  }
  for (const path of next) {
    if (!watched.has(path)) {
      watcher.add(path);
      watched.add(path);
    }
  }
}

export function closeWatcher(): void {
  void watcher?.close();
  watcher = null;
  watched.clear();
}
