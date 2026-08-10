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
import { createClaudeStatusTracker } from '../../shared/claude-status';
import {
  activateTab as activateTabState,
  activeTabs,
  addTab as addTabState,
  allTabs,
  CHAT_TAB_PTY,
  closeTab as closeTabState,
  emptyDocksState,
  findTab,
  moveTab as moveTabState,
  splitPane as splitPaneState,
  updateTab as updateTabState,
  type DockId,
  type DocksState,
  type TabKind,
} from '../../shared/dock-tabs';
import { createTerminalInstance, disposeTerminalInstance, serializeTerminal } from './terminals';
import { useDialogs } from './ui-dialogs';
import { useWorkspace } from './workspace';

interface AddTabOptions {
  /** Argumenty komendy startowej (np. ['/login'] dla logowania Claude). */
  args?: string[];
  /** Tytuł zakładki zamiast domyślnego. */
  title?: string;
  /** Panel docelowy (domyślnie ostatni panel doku). */
  paneId?: string;
}

interface DocksValue {
  docks: DocksState;
  addTab(dock: DockId, kind: TabKind, options?: AddTabOptions): void;
  activateTab(dock: DockId, paneId: string, id: string): void;
  closeTab(id: string): void;
  moveTab(id: string, targetDock: DockId, targetPaneId?: string): void;
  /** Wydziela zakładkę do nowego panelu obok (podział ekranu doku). */
  splitTab(id: string): void;
  /** Wyciąga kartę do osobnego okna (proces i scrollback zostają). */
  detachTab(id: string): void;
  /** Wpisuje tekst do pty aktywnej sesji Claude (preferuje aktywne zakładki paneli). */
  insertToActiveClaude(text: string): boolean;
  /** Otwiera (lub przenosi) kartę czatu z Claude we wskazanym doku. */
  openChatTab(dock: DockId): void;
}

const DocksContext = createContext<DocksValue | null>(null);

export function useDocks(): DocksValue {
  const value = useContext(DocksContext);
  if (!value) {
    throw new Error('useDocks wymaga DocksProvider');
  }
  return value;
}

let nextTabNumber = 1;
let nextPaneNumber = 1;

export function DocksProvider({ children }: { children: ReactNode }): ReactElement {
  const { root } = useWorkspace();
  const { confirmDialog, notify } = useDialogs();
  const [docks, setDocksRaw] = useState<DocksState>(emptyDocksState);
  const docksRef = useRef(docks);

  const applyDocks = useCallback((updater: (state: DocksState) => DocksState) => {
    docksRef.current = updater(docksRef.current);
    setDocksRaw(docksRef.current);
  }, []);

  const addTab = useCallback(
    (dock: DockId, kind: TabKind, options?: AddTabOptions) => {
      void window.api.ptyCreate({ kind, cwd: root, args: options?.args }).then((result) => {
        if (!result.ok) {
          notify(`Nie udało się uruchomić procesu: ${result.error}`, 'error');
          return;
        }
        const id = `tab-${nextTabNumber++}`;
        // Wskaźnik statusu (SPEC.md): heurystyka na strumieniu wyjściowym pty,
        // tylko dla zakładek `claude`.
        const onOutput =
          kind === 'claude'
            ? createClaudeStatusTracker((activity) => {
                applyDocks((state) => {
                  const found = findTab(state, id);
                  if (!found || found.tab.status === 'exited') {
                    return state;
                  }
                  return updateTabState(state, id, { status: activity });
                });
              }).push
            : undefined;
        createTerminalInstance(id, result.ptyId, onOutput);
        applyDocks((state) =>
          addTabState(
            state,
            dock,
            {
              id,
              kind,
              title: options?.title ?? result.title,
              cwd: root,
              ptyId: result.ptyId,
              status: 'running',
            },
            options?.paneId,
          ),
        );
      });
    },
    [applyDocks, notify, root],
  );

  const activateTab = useCallback(
    (dock: DockId, paneId: string, id: string) =>
      applyDocks((state) => activateTabState(state, dock, paneId, id)),
    [applyDocks],
  );

  const closeTab = useCallback(
    (id: string) => {
      const found = findTab(docksRef.current, id);
      if (!found) {
        return;
      }
      // Karta czatu nie ma procesu, a historia żyje w chat-store — bez pytań.
      if (found.tab.kind === 'chat') {
        applyDocks((state) => closeTabState(state, id));
        return;
      }
      const finish = (): void => {
        void window.api.ptyKill(found.tab.ptyId);
        disposeTerminalInstance(id);
        applyDocks((state) => closeTabState(state, id));
      };
      if (found.tab.status === 'exited') {
        finish();
        return;
      }
      // Zamknięcie karty ubija proces — pytamy, dopóki żyje.
      void confirmDialog({
        title: 'Zamknąć kartę?',
        message: `Karta „${found.tab.title}" ma działający proces — zostanie zakończony.`,
        confirmLabel: 'Zamknij',
        danger: true,
      }).then((accepted) => {
        if (accepted) {
          finish();
        }
      });
    },
    [applyDocks, confirmDialog],
  );

  const moveTab = useCallback(
    (id: string, targetDock: DockId, targetPaneId?: string) =>
      applyDocks((state) => moveTabState(state, id, targetDock, targetPaneId)),
    [applyDocks],
  );

  const splitTab = useCallback(
    (id: string) => applyDocks((state) => splitPaneState(state, id, `pane-${++nextPaneNumber}`)),
    [applyDocks],
  );

  const detachTab = useCallback(
    (id: string) => {
      const found = findTab(docksRef.current, id);
      if (!found || found.tab.kind === 'chat') {
        return;
      }
      const serialized = serializeTerminal(id) ?? '';
      disposeTerminalInstance(id);
      applyDocks((state) => closeTabState(state, id));
      void window.api.openTerminalWindow({
        ptyId: found.tab.ptyId,
        kind: found.tab.kind,
        title: found.tab.title,
        cwd: found.tab.cwd,
        serialized,
      });
    },
    [applyDocks],
  );

  const openChatTab = useCallback(
    (dock: DockId) => {
      const existing = allTabs(docksRef.current).find((tab) => tab.kind === 'chat');
      if (existing) {
        applyDocks((state) => moveTabState(state, existing.id, dock));
        return;
      }
      applyDocks((state) =>
        addTabState(state, dock, {
          id: `tab-${nextTabNumber++}`,
          kind: 'chat',
          title: 'Czat',
          cwd: root,
          ptyId: CHAT_TAB_PTY,
          status: 'running',
        }),
      );
    },
    [applyDocks, root],
  );

  const insertToActiveClaude = useCallback((text: string): boolean => {
    const state = docksRef.current;
    const candidates = [
      ...activeTabs(state).filter((tab) => tab.kind === 'claude' && tab.status !== 'exited'),
      ...allTabs(state).filter((tab) => tab.kind === 'claude' && tab.status !== 'exited'),
    ];
    const target = candidates[0];
    if (!target) {
      return false;
    }
    window.api.ptyWrite(target.ptyId, text);
    return true;
  }, []);

  // Wyjście procesu → status 'exited' na zakładce (proces ubijamy dopiero przy zamknięciu).
  useEffect(() => {
    window.api.onPtyExit(({ ptyId }) => {
      const exited = allTabs(docksRef.current).find((tab) => tab.ptyId === ptyId);
      if (exited) {
        applyDocks((state) => updateTabState(state, exited.id, { status: 'exited' }));
      }
    });
  }, [applyDocks]);

  return (
    <DocksContext.Provider
      value={{
        docks,
        addTab,
        activateTab,
        closeTab,
        moveTab,
        splitTab,
        detachTab,
        insertToActiveClaude,
        openChatTab,
      }}
    >
      {children}
    </DocksContext.Provider>
  );
}
