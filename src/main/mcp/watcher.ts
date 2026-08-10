import { watch, type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc';
import { mcpConfigFiles } from './index';

let watcher: FSWatcher | null = null;
let watchedRoot: string | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

/** Zmiana ~/.claude.json albo <root>/.mcp.json → `mcp:changed` (debounce 300 ms). */
export function watchMcpConfig(win: BrowserWindow, root: string): void {
  if (watchedRoot === root && watcher) {
    return;
  }
  watchedRoot = root;
  void watcher?.close();
  watcher = watch(mcpConfigFiles(root), { ignoreInitial: true });
  watcher.on('all', () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.McpChanged);
      }
    }, 300);
  });
}

export function closeMcpWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void watcher?.close();
  watcher = null;
  watchedRoot = null;
}
