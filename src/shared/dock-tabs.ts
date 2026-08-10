/**
 * Model Dock/Tab — centralna abstrakcja aplikacji (SPEC.md).
 * Czysta logika bez zależności — testowana jednostkowo.
 */

export type DockId = 'right' | 'bottom';
export type TabKind = 'terminal' | 'claude';
export type TabStatus = 'idle' | 'running' | 'needs-input' | 'exited';

export interface DockTab {
  id: string;
  kind: TabKind;
  title: string;
  cwd: string;
  /** Uchwyt procesu w main. Przenoszenie między dokami nie zmienia ptyId. */
  ptyId: number;
  status: TabStatus;
}

export interface DockState {
  tabs: DockTab[];
  activeId: string | null;
}

export interface DocksState {
  right: DockState;
  bottom: DockState;
}

export const DOCK_IDS: DockId[] = ['right', 'bottom'];

export const emptyDocksState: DocksState = {
  right: { tabs: [], activeId: null },
  bottom: { tabs: [], activeId: null },
};

export function findTab(state: DocksState, id: string): { dock: DockId; tab: DockTab } | null {
  for (const dock of DOCK_IDS) {
    const tab = state[dock].tabs.find((candidate) => candidate.id === id);
    if (tab) {
      return { dock, tab };
    }
  }
  return null;
}

export function addTab(state: DocksState, dock: DockId, tab: DockTab): DocksState {
  return {
    ...state,
    [dock]: { tabs: [...state[dock].tabs, tab], activeId: tab.id },
  };
}

export function activateTab(state: DocksState, dock: DockId, id: string): DocksState {
  if (!state[dock].tabs.some((tab) => tab.id === id)) {
    return state;
  }
  return { ...state, [dock]: { tabs: state[dock].tabs, activeId: id } };
}

export function closeTab(state: DocksState, id: string): DocksState {
  const found = findTab(state, id);
  if (!found) {
    return state;
  }
  const { dock } = found;
  const index = state[dock].tabs.findIndex((tab) => tab.id === id);
  const tabs = state[dock].tabs.filter((tab) => tab.id !== id);
  let activeId = state[dock].activeId;
  if (activeId === id) {
    activeId = (tabs[index] ?? tabs[index - 1])?.id ?? null;
  }
  return { ...state, [dock]: { tabs, activeId } };
}

/** Przenosi zakładkę do wskazanego doku (na koniec) i tam aktywuje. Proces zostaje ten sam. */
export function moveTab(state: DocksState, id: string, targetDock: DockId): DocksState {
  const found = findTab(state, id);
  if (!found) {
    return state;
  }
  if (found.dock === targetDock) {
    return activateTab(state, targetDock, id);
  }
  const withoutTab = closeTab(state, id);
  return addTab(withoutTab, targetDock, found.tab);
}

export function updateTab(state: DocksState, id: string, patch: Partial<DockTab>): DocksState {
  const found = findTab(state, id);
  if (!found) {
    return state;
  }
  const { dock } = found;
  return {
    ...state,
    [dock]: {
      tabs: state[dock].tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
      activeId: state[dock].activeId,
    },
  };
}

export function allTabs(state: DocksState): DockTab[] {
  return [...state.right.tabs, ...state.bottom.tabs];
}
