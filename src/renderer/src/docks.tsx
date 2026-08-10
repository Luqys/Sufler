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
  addTab as addTabState,
  closeTab as closeTabState,
  emptyDocksState,
  findTab,
  moveTab as moveTabState,
  updateTab as updateTabState,
  type DockId,
  type DocksState,
  type TabKind,
} from '../../shared/dock-tabs';
import { createTerminalInstance, disposeTerminalInstance } from './terminals';
import { useWorkspace } from './workspace';

interface AddTabOptions {
  /** Argumenty komendy startowej (np. ['/login'] dla logowania Claude). */
  args?: string[];
  /** Tytuł zakładki zamiast domyślnego. */
  title?: string;
}

interface DocksValue {
  docks: DocksState;
  addTab(dock: DockId, kind: TabKind, options?: AddTabOptions): void;
  activateTab(dock: DockId, id: string): void;
  closeTab(id: string): void;
  moveTab(id: string, targetDock: DockId): void;
  /** Wpisuje tekst do pty aktywnej sesji Claude (preferuje aktywne zakładki). */
  insertToActiveClaude(text: string): boolean;
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

export function DocksProvider({ children }: { children: ReactNode }): ReactElement {
  const { root } = useWorkspace();
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
          window.alert(`Nie udało się uruchomić procesu: ${result.error}`);
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
          addTabState(state, dock, {
            id,
            kind,
            title: options?.title ?? result.title,
            cwd: root,
            ptyId: result.ptyId,
            status: 'running',
          }),
        );
      });
    },
    [applyDocks, root],
  );

  const activateTab = useCallback(
    (dock: DockId, id: string) => applyDocks((state) => activateTabState(state, dock, id)),
    [applyDocks],
  );

  const closeTab = useCallback(
    (id: string) => {
      const found = findTab(docksRef.current, id);
      if (!found) {
        return;
      }
      void window.api.ptyKill(found.tab.ptyId);
      disposeTerminalInstance(id);
      applyDocks((state) => closeTabState(state, id));
    },
    [applyDocks],
  );

  const moveTab = useCallback(
    (id: string, targetDock: DockId) => applyDocks((state) => moveTabState(state, id, targetDock)),
    [applyDocks],
  );

  const insertToActiveClaude = useCallback((text: string): boolean => {
    const state = docksRef.current;
    const activeTabs = (['right', 'bottom'] as const).map((dock) =>
      state[dock].tabs.find((tab) => tab.id === state[dock].activeId),
    );
    const anyClaude = [...state.right.tabs, ...state.bottom.tabs].filter(
      (tab) => tab.kind === 'claude' && tab.status !== 'exited',
    );
    const target =
      activeTabs.find((tab) => tab?.kind === 'claude' && tab.status !== 'exited') ?? anyClaude[0];
    if (!target) {
      return false;
    }
    window.api.ptyWrite(target.ptyId, text);
    return true;
  }, []);

  // Wyjście procesu → status 'exited' na zakładce (proces ubijamy dopiero przy zamknięciu).
  useEffect(() => {
    window.api.onPtyExit(({ ptyId }) => {
      const exited = [...docksRef.current.right.tabs, ...docksRef.current.bottom.tabs].find(
        (tab) => tab.ptyId === ptyId,
      );
      if (exited) {
        applyDocks((state) => updateTabState(state, exited.id, { status: 'exited' }));
      }
    });
  }, [applyDocks]);

  return (
    <DocksContext.Provider
      value={{ docks, addTab, activateTab, closeTab, moveTab, insertToActiveClaude }}
    >
      {children}
    </DocksContext.Provider>
  );
}
