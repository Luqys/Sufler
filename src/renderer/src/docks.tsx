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

interface DocksValue {
  docks: DocksState;
  addTab(dock: DockId, kind: TabKind): void;
  activateTab(dock: DockId, id: string): void;
  closeTab(id: string): void;
  moveTab(id: string, targetDock: DockId): void;
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
    (dock: DockId, kind: TabKind) => {
      void window.api.ptyCreate({ kind, cwd: root }).then((result) => {
        if (!result.ok) {
          window.alert(`Nie udało się uruchomić procesu: ${result.error}`);
          return;
        }
        const id = `tab-${nextTabNumber++}`;
        createTerminalInstance(id, result.ptyId);
        applyDocks((state) =>
          addTabState(state, dock, {
            id,
            kind,
            title: result.title,
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
    <DocksContext.Provider value={{ docks, addTab, activateTab, closeTab, moveTab }}>
      {children}
    </DocksContext.Provider>
  );
}
