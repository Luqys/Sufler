import { watch, type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc';
import { claudeMdCandidates, skillsSourceDirs } from './skills';

let watcher: FSWatcher | null = null;
let watchedRoot: string | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Obserwuje katalogi skilli/agentów/reguł i pliki CLAUDE.md dla danego korzenia.
 * Zdarzenia są zbijane w jedno powiadomienie `skills:changed` (debounce 300 ms).
 */
export function watchSkillsSources(win: BrowserWindow, root: string): void {
  if (watchedRoot === root && watcher) {
    return;
  }
  watchedRoot = root;
  void watcher?.close();
  const targets = [...skillsSourceDirs(root), ...claudeMdCandidates(root).map((c) => c.path)];
  watcher = watch(targets, { ignoreInitial: true, depth: 2 });
  const notify = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.SkillsChanged);
      }
    }, 300);
  };
  watcher.on('all', notify);
}

export function closeSkillsWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void watcher?.close();
  watcher = null;
  watchedRoot = null;
}
