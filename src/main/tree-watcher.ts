import { watch, type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc';

let watcher: FSWatcher | null = null;
const watched = new Set<string>();

/**
 * Obserwacja TYLKO rozwiniętych katalogów drzewa (depth 0) — ryzyko nr 3
 * ze SPEC.md zabrania rekurencyjnego watchowania całego projektu.
 */
export function setWatchedTreeDirs(win: BrowserWindow, dirs: string[]): void {
  if (!watcher) {
    watcher = watch([], { ignoreInitial: true, depth: 0 });
    watcher.on('all', (_event, path) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.TreeChanged, { path });
      }
    });
  }
  const next = new Set(dirs);
  for (const dir of watched) {
    if (!next.has(dir)) {
      void watcher.unwatch(dir);
      watched.delete(dir);
    }
  }
  for (const dir of next) {
    if (!watched.has(dir)) {
      watcher.add(dir);
      watched.add(dir);
    }
  }
}

export function closeTreeWatcher(): void {
  void watcher?.close();
  watcher = null;
  watched.clear();
}
