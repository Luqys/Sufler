import { watch, type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc';
import { KNOWLEDGE_OUTPUT, OUTLINE_OUTPUT } from './knowledge';

/**
 * Obserwuje notatki .md projektu: każda zmiana wysyła `knowledge:changed`,
 * a graf i panel Wiedzy odświeżają się same. Konspekt dla Claude liczy się
 * na żądanie w narzędziu MCP, więc watcher niczego nie zapisuje na dysk (M96).
 */

let watcher: FSWatcher | null = null;
let watchedRoot: string | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'out', '.git', '.obsidian', '.trash']);

export function watchKnowledge(win: BrowserWindow, root: string): void {
  if (watchedRoot === root && watcher) {
    return;
  }
  watchedRoot = root;
  void watcher?.close();
  watcher = watch(root, {
    ignoreInitial: true,
    depth: 6,
    ignored: (path: string) => {
      const rel = path.length > root.length ? path.slice(root.length + 1) : '';
      if (!rel) {
        return false;
      }
      const parts = rel.split('/');
      if (parts.some((part) => IGNORED_DIRS.has(part) || part.startsWith('.'))) {
        return true;
      }
      const last = parts[parts.length - 1] ?? '';
      if (!last.includes('.')) {
        return false; // katalog — schodzimy głębiej
      }
      return !last.endsWith('.md') || last === KNOWLEDGE_OUTPUT || last === OUTLINE_OUTPUT;
    },
  });
  const notify = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.KnowledgeChanged);
      }
    }, 400);
  };
  watcher.on('all', notify);
  // Konspekt istnieje od wejścia do projektu, nie dopiero od pierwszej zmiany.
}

export function closeKnowledgeWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void watcher?.close();
  watcher = null;
  watchedRoot = null;
}
