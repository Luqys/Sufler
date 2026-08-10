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
  activateTabInGroup,
  activeGroup,
  allOpenPaths,
  closeTabInGroup,
  groupsWithPath,
  initialGroupsState,
  openTabInActiveGroup,
  pinTabEverywhere,
  pinTabInGroup,
  reorderTabInGroup,
  setActiveGroup,
  splitGroup as splitGroupState,
  type EditorGroupsState,
} from '../../shared/editor-groups';
import {
  diffTabPath,
  diffTabTitle,
  isDiffPath,
  parseDiffPath,
  type DiffDescriptor,
} from '../../shared/diff-tabs';
import type { IdeBridgeRequestPayload, ReadFileError, WatchEvent } from '../../shared/ipc';
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
import {
  getPendingDiff,
  registerPendingDiff,
  removePendingDiff,
  resolvePendingDiff,
} from './ide/pending-diffs';
import { WelcomeScreen } from './components/WelcomeScreen';
import { t, tf } from './i18n';
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
  /** Grupy edytora (M31) — podział przestrzeni roboczej na kolumny. */
  groups: EditorGroupsState;
  buffers: ReadonlyMap<string, BufferInfo>;
  dirtyPaths: ReadonlySet<string>;
  revealTarget: RevealTarget | null;
  openFile(path: string, options?: { pinned?: boolean }): void;
  openFileAt(path: string, line: number, column: number): void;
  openBrowserPreview(): void;
  openKnowledgeGraph(): void;
  /** Zakładka diffa (M33): zmiany robocze, zmiana z commita albo propozycja CLI. */
  openDiffTab(descriptor: DiffDescriptor): void;
  /** Zapis propozycji openDiff (null → treść z rejestru) i odpowiedź FILE_SAVED do CLI. */
  acceptIdeDiff(descriptor: Extract<DiffDescriptor, { kind: 'ide' }>, content: string | null): void;
  rejectIdeDiff(descriptor: Extract<DiffDescriptor, { kind: 'ide' }>): void;
  chooseVault(): void;
  clearVault(): void;
  /** Uaktywnia grupę (kliknięcie gdziekolwiek w jej obrębie). */
  focusGroup(groupId: string): void;
  /** Dzieli grupę — nowa grupa obok, z klonem aktywnej zakładki. Bez limitu. */
  splitEditorGroup(groupId: string): void;
  activateTab(groupId: string, path: string): void;
  pinTab(groupId: string, path: string): void;
  /** Przeciąganie zakładki w pasku — wstawia ją na pozycję zakładki docelowej. */
  reorderTab(groupId: string, fromPath: string, toPath: string): void;
  closeTab(groupId: string, path: string): void;
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
      return t('editor.readTooLarge');
    case 'binary':
      return t('editor.readBinary');
    case 'unreadable':
      return t('editor.readFailed');
  }
}

let nextGroupNumber = 1;

export function WorkspaceProvider({ children }: { children: ReactNode }): ReactElement | null {
  const { confirmDialog, notify } = useDialogs();
  const [root, setRoot] = useState<string | null>(null);
  const [rootResolved, setRootResolved] = useState(false);

  const [groups, setGroupsRaw] = useState<EditorGroupsState>(() => initialGroupsState());
  const groupsRef = useRef(groups);

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

  /** Zmiana grup + sprzątanie modeli/buforów po ścieżkach, które zniknęły ze wszystkich grup. */
  const applyGroups = useCallback(
    (updater: (state: EditorGroupsState) => EditorGroupsState) => {
      const before = allOpenPaths(groupsRef.current);
      groupsRef.current = updater(groupsRef.current);
      setGroupsRaw(groupsRef.current);
      const after = new Set(allOpenPaths(groupsRef.current));
      for (const path of before) {
        if (!after.has(path)) {
          // Zamknięcie propozycji CLI bez decyzji liczy się jako odrzucenie —
          // inaczej sesja Claude czekałaby na odpowiedź w nieskończoność.
          const diffDescriptor = parseDiffPath(path);
          if (diffDescriptor?.kind === 'ide') {
            resolvePendingDiff(diffDescriptor.requestId, 'rejected');
            removePendingDiff(diffDescriptor.requestId);
          }
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
  // zastąpiłby zakładkę z niezapisanymi zmianami (we wszystkich grupach).
  useEffect(() => {
    setDirtyListener((path, dirty) => {
      if (dirty) {
        applyGroups((state) => pinTabEverywhere(state, path));
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
  }, [applyGroups]);

  const openFile = useCallback(
    (path: string, options?: { pinned?: boolean }) => {
      const pinned = options?.pinned ?? false;
      const open = (): void =>
        applyGroups((state) => openTabInActiveGroup(state, path, baseName(path), pinned));
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
    [applyGroups, patchBuffers],
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

  const focusGroup = useCallback(
    (groupId: string) => applyGroups((state) => setActiveGroup(state, groupId)),
    [applyGroups],
  );

  const splitEditorGroup = useCallback(
    (groupId: string) =>
      applyGroups((state) => splitGroupState(state, groupId, `group-${++nextGroupNumber}`)),
    [applyGroups],
  );

  const activateTab = useCallback(
    (groupId: string, path: string) =>
      applyGroups((state) => activateTabInGroup(state, groupId, path)),
    [applyGroups],
  );

  const pinTab = useCallback(
    (groupId: string, path: string) => applyGroups((state) => pinTabInGroup(state, groupId, path)),
    [applyGroups],
  );

  const reorderTab = useCallback(
    (groupId: string, fromPath: string, toPath: string) =>
      applyGroups((state) => reorderTabInGroup(state, groupId, fromPath, toPath)),
    [applyGroups],
  );

  const closeTab = useCallback(
    (groupId: string, path: string) => {
      // Pytamy o niezapisane zmiany tylko przy ostatnim wystąpieniu ścieżki —
      // dopóki plik żyje w innej grupie, model i zmiany zostają.
      const lastOccurrence = groupsWithPath(groupsRef.current, path) <= 1;
      if (!isDirty(path) || !lastOccurrence) {
        applyGroups((state) => closeTabInGroup(state, groupId, path));
        return;
      }
      void confirmDialog({
        title: t('editor.unsavedTitle'),
        message: tf('editor.unsavedMessage', { name: baseName(path) }),
        confirmLabel: t('editor.closeWithoutSave'),
        danger: true,
      }).then((accepted) => {
        if (accepted) {
          applyGroups((state) => closeTabInGroup(state, groupId, path));
        }
      });
    },
    [applyGroups, confirmDialog],
  );

  const saveActiveFile = useCallback(() => {
    const path = activeGroup(groupsRef.current).activePath;
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
        notify(tf('editor.saveFailed', { error: result.error }), 'error');
      }
    });
  }, [notify, patchBuffers]);

  const reloadActiveFromDisk = useCallback(() => {
    const path = activeGroup(groupsRef.current).activePath;
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
    const path = activeGroup(groupsRef.current).activePath;
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
        applyGroups(() => initialGroupsState());
        setRoot(picked);
      }
    });
  }, [applyGroups]);

  // Obserwacja plików otwartych w zakładkach (bez pseudo-zakładek vn3o://).
  useEffect(() => {
    void window.api.watchFiles(allOpenPaths(groups).filter((path) => !path.startsWith('vn3o://')));
  }, [groups]);

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
    applyGroups((state) =>
      openTabInActiveGroup(state, BROWSER_PREVIEW_PATH, t('tabs.previewTitle'), true),
    );
  }, [applyGroups]);

  const openDiffTab = useCallback(
    (descriptor: DiffDescriptor) => {
      const title = diffTabTitle(descriptor, {
        worktreeSuffix: t('diff.worktreeSuffix'),
        ideDefault: t('diff.ideDefault'),
      });
      applyGroups((state) => openTabInActiveGroup(state, diffTabPath(descriptor), title, true));
    },
    [applyGroups],
  );

  /** Zamyka ścieżkę we wszystkich grupach (diffy otwierane są przypięte). */
  const closeEverywhere = useCallback(
    (path: string) => {
      applyGroups((state) => {
        let next = state;
        for (const group of state.groups) {
          if (group.tabs.some((tab) => tab.path === path)) {
            next = closeTabInGroup(next, group.id, path);
          }
        }
        return next;
      });
    },
    [applyGroups],
  );

  const acceptIdeDiff = useCallback(
    (descriptor: Extract<DiffDescriptor, { kind: 'ide' }>, content: string | null) => {
      const pendingDiff = getPendingDiff(descriptor.requestId);
      const finalContent = content ?? pendingDiff?.newContents ?? '';
      void window.api.writeFile(descriptor.newPath, finalContent).then((result) => {
        if (!result.ok) {
          notify(tf('editor.saveFailed', { error: result.error }), 'error');
          return;
        }
        // Plik otwarty w edytorze dostaje nową treść od razu, bez paska „zmiana zewnętrzna".
        if (buffersRef.current.has(descriptor.newPath)) {
          reloadModel(descriptor.newPath, finalContent);
          patchBuffers((next) =>
            next.set(descriptor.newPath, {
              savedText: finalContent,
              external: null,
              loadError: null,
            }),
          );
        }
        resolvePendingDiff(descriptor.requestId, 'saved');
        closeEverywhere(diffTabPath(descriptor));
      });
    },
    [closeEverywhere, notify, patchBuffers],
  );

  const rejectIdeDiff = useCallback(
    (descriptor: Extract<DiffDescriptor, { kind: 'ide' }>) => {
      resolvePendingDiff(descriptor.requestId, 'rejected');
      closeEverywhere(diffTabPath(descriptor));
    },
    [closeEverywhere],
  );

  // Mostek serwera „ide": żądania CLI (openDiff/openFile/getOpenEditors…)
  // obsługiwane na aktualnym stanie przez ref — subskrypcja raz na życie okna.
  const ideRequestRef = useRef<(request: IdeBridgeRequestPayload) => void>(() => {});
  useEffect(() => {
    ideRequestRef.current = (request: IdeBridgeRequestPayload) => {
      const respond = (result: unknown): void => window.api.ideBridgeRespond(request.id, result);
      const params = request.params;
      switch (request.method) {
        case 'openDiff': {
          const oldPath = String(params['old_file_path'] ?? '');
          const newPath = String(params['new_file_path'] ?? oldPath);
          const newContents = String(params['new_file_contents'] ?? '');
          const tabName = typeof params['tab_name'] === 'string' ? params['tab_name'] : '';
          registerPendingDiff(request.id, { oldPath, newPath, newContents, tabName });
          openDiffTab({ kind: 'ide', requestId: request.id, oldPath, newPath, tabName });
          // Odpowiedź dopiero po decyzji użytkownika (Zastosuj/Odrzuć/zamknięcie).
          break;
        }
        case 'openFile': {
          const filePath = String(params['filePath'] ?? params['path'] ?? '');
          if (filePath) {
            openFile(filePath, { pinned: true });
            respond({ success: true, message: `Opened ${filePath}` });
          } else {
            respond({ success: false, message: 'filePath required' });
          }
          break;
        }
        case 'getOpenEditors': {
          const state = groupsRef.current;
          const active = activeGroup(state).activePath;
          const paths = allOpenPaths(state).filter((path) => !path.startsWith('vn3o://'));
          respond({
            tabs: paths.map((path) => ({
              uri: `file://${path}`,
              path,
              label: baseName(path),
              isActive: path === active,
              isDirty: isDirty(path),
            })),
          });
          break;
        }
        case 'checkDocumentDirty': {
          const filePath = String(params['filePath'] ?? '');
          respond({ success: true, filePath, isDirty: isDirty(filePath) });
          break;
        }
        case 'saveDocument': {
          const filePath = String(params['filePath'] ?? '');
          const content = getModelValue(filePath);
          if (content === null) {
            respond({ success: false, message: 'Document is not open' });
            break;
          }
          void window.api.writeFile(filePath, content).then((result) => {
            if (result.ok) {
              markSaved(filePath);
              if (buffersRef.current.has(filePath)) {
                patchBuffers((next) =>
                  next.set(filePath, { savedText: content, external: null, loadError: null }),
                );
              }
            }
            respond({ success: result.ok });
          });
          break;
        }
        case 'close_tab': {
          const tabName = String(params['tab_name'] ?? '');
          let found: string | null = null;
          for (const group of groupsRef.current.groups) {
            for (const tab of group.tabs) {
              if (tab.title === tabName || baseName(tab.path) === tabName) {
                found = tab.path;
              }
            }
          }
          if (found) {
            closeEverywhere(found);
          }
          respond({ success: found !== null });
          break;
        }
        case 'closeAllDiffTabs': {
          const diffPaths = allOpenPaths(groupsRef.current).filter((path) => isDiffPath(path));
          for (const path of diffPaths) {
            closeEverywhere(path);
          }
          respond({ success: true, closed: diffPaths.length });
          break;
        }
        default:
          respond({ success: false, message: `Unknown method: ${request.method}` });
      }
    };
  });
  useEffect(() => {
    window.api.onIdeBridgeRequest((request) => ideRequestRef.current(request));
  }, []);

  const openKnowledgeGraph = useCallback(() => {
    applyGroups((state) =>
      openTabInActiveGroup(state, KNOWLEDGE_GRAPH_PATH, t('tabs.graphTitle'), true),
    );
  }, [applyGroups]);

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
        groups,
        buffers,
        dirtyPaths,
        revealTarget,
        openFile,
        openFileAt,
        openBrowserPreview,
        openKnowledgeGraph,
        openDiffTab,
        acceptIdeDiff,
        rejectIdeDiff,
        focusGroup,
        splitEditorGroup,
        activateTab,
        pinTab,
        reorderTab,
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
