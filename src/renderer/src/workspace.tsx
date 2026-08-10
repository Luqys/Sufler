import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  activateTab as activateTabState,
  closeTab as closeTabState,
  emptyTabsState,
  openTab as openTabState,
  pinTab as pinTabState,
  type EditorTabsState,
} from '../../shared/editor-tabs';
import { CHAT_PATH } from '../../shared/chat';
import type { ReadFileError, WatchEvent } from '../../shared/ipc';
import { isImagePath } from '../../shared/media';
import { baseName } from '../../shared/paths';
import { BROWSER_PREVIEW_PATH, KNOWLEDGE_GRAPH_PATH } from '../../shared/preview';
import {
  disposeModel,
  ensureModel,
  getModelValue,
  isDirty,
  markKeptMine,
  markSaved,
  reloadModel,
  setDirtyListener,
} from './editor/models';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useDialogs } from './ui-dialogs';

export interface BufferInfo {
  /** Treść zgodna z dyskiem przy ostatnim wczytaniu/zapisie — do tłumienia echa własnych zapisów. */
  savedText: string;
  external: 'changed' | 'deleted' | null;
  loadError: string | null;
}

export interface RevealTarget {
  path: string;
  line: number;
  column: number;
  nonce: number;
}

interface WorkspaceValue {
  root: string;
  /** Vault Obsidiana — drugi korzeń drzewa plików (warstwa 1 integracji). */
  vault: string | null;
  tabsState: EditorTabsState;
  buffers: ReadonlyMap<string, BufferInfo>;
  dirtyPaths: ReadonlySet<string>;
  revealTarget: RevealTarget | null;
  openFile(path: string, options?: { pinned?: boolean }): void;
  openFileAt(path: string, line: number, column: number): void;
  openBrowserPreview(): void;
  openKnowledgeGraph(): void;
  openChat(): void;
  chooseVault(): void;
  clearVault(): void;
  activateTab(path: string): void;
  pinTab(path: string): void;
  closeTab(path: string): void;
  saveActiveFile(): void;
  reloadActiveFromDisk(): void;
  keepMyVersion(): void;
  chooseProject(): void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useWorkspace wymaga WorkspaceProvider');
  }
  return value;
}

function describeReadError(error: ReadFileError): string {
  switch (error) {
    case 'too-large':
      return 'Plik jest zbyt duży (limit 10 MB).';
    case 'binary':
      return 'Plik binarny — podgląd niedostępny.';
    case 'unreadable':
      return 'Nie udało się odczytać pliku.';
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }): ReactElement | null {
  const { confirmDialog, notify } = useDialogs();
  const [root, setRoot] = useState<string | null>(null);
  const [rootResolved, setRootResolved] = useState(false);

  const [tabsState, setTabsStateRaw] = useState<EditorTabsState>(emptyTabsState);
  const tabsRef = useRef(tabsState);

  const buffersRef = useRef<Map<string, BufferInfo>>(new Map());
  const [buffers, setBuffersState] = useState<ReadonlyMap<string, BufferInfo>>(buffersRef.current);

  const [dirtyPaths, setDirtyPaths] = useState<ReadonlySet<string>>(new Set());

  const patchBuffers = useCallback((mutate: (next: Map<string, BufferInfo>) => void) => {
    const next = new Map(buffersRef.current);
    mutate(next);
    buffersRef.current = next;
    setBuffersState(next);
  }, []);

  const dropDirty = useCallback((path: string) => {
    setDirtyPaths((prev) => {
      if (!prev.has(path)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  /** Zmiana zakładek + sprzątanie modeli/buforów po zakładkach, które zniknęły (np. zastąpiony podgląd). */
  const applyTabs = useCallback(
    (updater: (state: EditorTabsState) => EditorTabsState) => {
      const before = tabsRef.current.tabs.map((tab) => tab.path);
      tabsRef.current = updater(tabsRef.current);
      setTabsStateRaw(tabsRef.current);
      const after = new Set(tabsRef.current.tabs.map((tab) => tab.path));
      for (const path of before) {
        if (!after.has(path)) {
          disposeModel(path);
          patchBuffers((next) => {
            next.delete(path);
          });
          dropDirty(path);
        }
      }
    },
    [dropDirty, patchBuffers],
  );

  const [vault, setVault] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api.getProjectRoot().then((projectRoot) => {
      if (!cancelled) {
        setRoot(projectRoot);
        setRootResolved(true);
      }
    });
    void window.api.getVaultPath().then((vaultPath) => {
      if (!cancelled) {
        setVault(vaultPath);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseVault = useCallback(() => {
    void window.api.chooseVault().then((picked) => {
      if (picked) {
        setVault(picked);
      }
    });
  }, []);

  const clearVault = useCallback(() => {
    void window.api.clearVault().then(() => setVault(null));
  }, []);

  // Brudny podgląd przypina się automatycznie — inaczej kolejny podgląd
  // zastąpiłby zakładkę z niezapisanymi zmianami.
  useEffect(() => {
    setDirtyListener((path, dirty) => {
      if (dirty) {
        applyTabs((state) => pinTabState(state, path));
      }
      setDirtyPaths((prev) => {
        if (prev.has(path) === dirty) {
          return prev;
        }
        const next = new Set(prev);
        if (dirty) {
          next.add(path);
        } else {
          next.delete(path);
        }
        return next;
      });
    });
    return () => setDirtyListener(null);
  }, [applyTabs]);

  const openFile = useCallback(
    (path: string, options?: { pinned?: boolean }) => {
      const pinned = options?.pinned ?? false;
      const open = (): void => applyTabs((state) => openTabState(state, path, baseName(path), pinned));
      if (buffersRef.current.has(path)) {
        open();
        return;
      }
      // Obrazki renderuje ImageViewer — bez bufora tekstowego i modelu Monaco.
      if (isImagePath(path)) {
        open();
        return;
      }
      void window.api.readFile(path).then((result) => {
        if (!buffersRef.current.has(path)) {
          if (result.ok) {
            ensureModel(path, result.content);
            patchBuffers((next) =>
              next.set(path, { savedText: result.content, external: null, loadError: null }),
            );
          } else {
            patchBuffers((next) =>
              next.set(path, {
                savedText: '',
                external: null,
                loadError: describeReadError(result.error),
              }),
            );
          }
        }
        open();
      });
    },
    [applyTabs, patchBuffers],
  );

  const [revealTarget, setRevealTarget] = useState<RevealTarget | null>(null);
  const revealNonce = useRef(0);

  const openFileAt = useCallback(
    (path: string, line: number, column: number) => {
      revealNonce.current += 1;
      setRevealTarget({ path, line, column, nonce: revealNonce.current });
      openFile(path);
    },
    [openFile],
  );

  const activateTab = useCallback(
    (path: string) => applyTabs((state) => activateTabState(state, path)),
    [applyTabs],
  );

  const pinTab = useCallback(
    (path: string) => applyTabs((state) => pinTabState(state, path)),
    [applyTabs],
  );

  const closeTab = useCallback(
    (path: string) => {
      if (!isDirty(path)) {
        applyTabs((state) => closeTabState(state, path));
        return;
      }
      void confirmDialog({
        title: 'Niezapisane zmiany',
        message: `Plik „${baseName(path)}" ma niezapisane zmiany. Zamknąć mimo to?`,
        confirmLabel: 'Zamknij bez zapisu',
        danger: true,
      }).then((accepted) => {
        if (accepted) {
          applyTabs((state) => closeTabState(state, path));
        }
      });
    },
    [applyTabs, confirmDialog],
  );

  const saveActiveFile = useCallback(() => {
    const path = tabsRef.current.activePath;
    if (!path) {
      return;
    }
    const buffer = buffersRef.current.get(path);
    if (!buffer || buffer.loadError) {
      return;
    }
    const content = getModelValue(path);
    if (content === null) {
      return;
    }
    void window.api.writeFile(path, content).then((result) => {
      if (result.ok) {
        markSaved(path);
        patchBuffers((next) =>
          next.set(path, { savedText: content, external: null, loadError: null }),
        );
      } else {
        notify(`Nie udało się zapisać pliku: ${result.error}`, 'error');
      }
    });
  }, [notify, patchBuffers]);

  const reloadActiveFromDisk = useCallback(() => {
    const path = tabsRef.current.activePath;
    if (!path) {
      return;
    }
    void window.api.readFile(path).then((result) => {
      const buffer = buffersRef.current.get(path);
      if (!buffer) {
        return;
      }
      if (!result.ok) {
        patchBuffers((next) => next.set(path, { ...buffer, external: 'deleted' }));
        return;
      }
      reloadModel(path, result.content);
      patchBuffers((next) =>
        next.set(path, { savedText: result.content, external: null, loadError: null }),
      );
    });
  }, [patchBuffers]);

  const keepMyVersion = useCallback(() => {
    const path = tabsRef.current.activePath;
    if (!path) {
      return;
    }
    const buffer = buffersRef.current.get(path);
    if (!buffer) {
      return;
    }
    markKeptMine(path);
    patchBuffers((next) => next.set(path, { ...buffer, external: null }));
  }, [patchBuffers]);

  const chooseProject = useCallback(() => {
    void window.api.openProjectDialog().then((picked) => {
      if (picked) {
        applyTabs(() => emptyTabsState);
        setRoot(picked);
      }
    });
  }, [applyTabs]);

  // Obserwacja plików otwartych w zakładkach (bez pseudo-zakładek vn3o://).
  useEffect(() => {
    void window.api.watchFiles(
      tabsState.tabs.map((tab) => tab.path).filter((path) => !path.startsWith('vn3o://')),
    );
  }, [tabsState.tabs]);

  const handleWatchEvent = useCallback(
    (event: WatchEvent) => {
      if (!buffersRef.current.has(event.path)) {
        return;
      }
      void (async () => {
        // Chwila oddechu dla piszącego (zapis tmp + rename bywa dwuetapowy).
        await new Promise((resolve) => setTimeout(resolve, 120));
        const result = await window.api.readFile(event.path);
        const buffer = buffersRef.current.get(event.path);
        if (!buffer) {
          return;
        }
        if (!result.ok) {
          patchBuffers((next) => next.set(event.path, { ...buffer, external: 'deleted' }));
          return;
        }
        if (result.content === buffer.savedText) {
          // Echo własnego zapisu albo powrót do znanego stanu.
          if (buffer.external !== null) {
            patchBuffers((next) => next.set(event.path, { ...buffer, external: null }));
          }
          return;
        }
        if (result.content === getModelValue(event.path)) {
          // Dysk dogonił bufor — przyjmujemy po cichu.
          markSaved(event.path);
          patchBuffers((next) =>
            next.set(event.path, { savedText: result.content, external: null, loadError: null }),
          );
          return;
        }
        patchBuffers((next) => next.set(event.path, { ...buffer, external: 'changed' }));
      })();
    },
    [patchBuffers],
  );

  useEffect(() => {
    window.api.onWatchEvent(handleWatchEvent);
  }, [handleWatchEvent]);

  const openBrowserPreview = useCallback(() => {
    applyTabs((state) => openTabState(state, BROWSER_PREVIEW_PATH, 'Podgląd', true));
  }, [applyTabs]);

  const openKnowledgeGraph = useCallback(() => {
    applyTabs((state) => openTabState(state, KNOWLEDGE_GRAPH_PATH, 'Graf wiedzy', true));
  }, [applyTabs]);

  const openChat = useCallback(() => {
    applyTabs((state) => openTabState(state, CHAT_PATH, 'Czat', true));
  }, [applyTabs]);

  // Cmd+S zapisuje aktywną zakładkę niezależnie od tego, co ma fokus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        saveActiveFile();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [saveActiveFile]);

  if (!rootResolved) {
    return null;
  }
  if (root === null) {
    return (
      <WelcomeScreen
        onPicked={(picked) => {
          setRoot(picked);
        }}
      />
    );
  }
  return (
    <WorkspaceContext.Provider
      value={{
        root,
        vault,
        tabsState,
        buffers,
        dirtyPaths,
        revealTarget,
        openFile,
        openFileAt,
        openBrowserPreview,
        openKnowledgeGraph,
        openChat,
        activateTab,
        pinTab,
        closeTab,
        saveActiveFile,
        reloadActiveFromDisk,
        keepMyVersion,
        chooseProject,
        chooseVault,
        clearVault,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
