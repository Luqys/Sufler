/**
 * Model Dock/Pane/Tab — centralna abstrakcja aplikacji (zasada projektu).
 * Dok składa się z paneli (dolny: kolumny, prawy: wiersze), panel z zakładek.
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
  /** Uchwyt procesu w main. Przenoszenie między dokami/panelami nie zmienia ptyId. */
  ptyId: number;
  status: TabStatus;
}

export interface DockPane {
  id: string;
  tabs: DockTab[];
  activeId: string | null;
}

export interface DockState {
  /** Zawsze co najmniej jeden panel. */
  panes: DockPane[];
}

export interface DocksState {
  right: DockState;
  bottom: DockState;
}

export const DOCK_IDS: DockId[] = ['right', 'bottom'];

function emptyPane(id: string): DockPane {
  return { id, tabs: [], activeId: null };
}

export const emptyDocksState: DocksState = {
  right: { panes: [emptyPane('right-1')] },
  bottom: { panes: [emptyPane('bottom-1')] },
};

export interface FoundTab {
  dock: DockId;
  paneId: string;
  tab: DockTab;
}

export function findTab(state: DocksState, id: string): FoundTab | null {
  for (const dock of DOCK_IDS) {
    for (const pane of state[dock].panes) {
      const tab = pane.tabs.find((candidate) => candidate.id === id);
      if (tab) {
        return { dock, paneId: pane.id, tab };
      }
    }
  }
  return null;
}

function replacePanes(state: DocksState, dock: DockId, panes: DockPane[]): DocksState {
  return { ...state, [dock]: { panes } };
}

/** Puste panele znikają, ale ostatni panel doku zawsze zostaje. */
function collapseEmpty(panes: DockPane[]): DockPane[] {
  const nonEmpty = panes.filter((pane) => pane.tabs.length > 0);
  if (nonEmpty.length > 0) {
    return nonEmpty;
  }
  const first = panes[0];
  return first ? [first] : panes;
}

export function addTab(
  state: DocksState,
  dock: DockId,
  tab: DockTab,
  paneId?: string,
): DocksState {
  const panes = state[dock].panes;
  const targetId = paneId && panes.some((pane) => pane.id === paneId)
    ? paneId
    : panes[panes.length - 1]?.id;
  return replacePanes(
    state,
    dock,
    panes.map((pane) =>
      pane.id === targetId ? { ...pane, tabs: [...pane.tabs, tab], activeId: tab.id } : pane,
    ),
  );
}

export function activateTab(
  state: DocksState,
  dock: DockId,
  paneId: string,
  id: string,
): DocksState {
  return replacePanes(
    state,
    dock,
    state[dock].panes.map((pane) =>
      pane.id === paneId && pane.tabs.some((tab) => tab.id === id)
        ? { ...pane, activeId: id }
        : pane,
    ),
  );
}

export function closeTab(state: DocksState, id: string): DocksState {
  const found = findTab(state, id);
  if (!found) {
    return state;
  }
  const panes = state[found.dock].panes.map((pane) => {
    if (pane.id !== found.paneId) {
      return pane;
    }
    const index = pane.tabs.findIndex((tab) => tab.id === id);
    const tabs = pane.tabs.filter((tab) => tab.id !== id);
    let activeId = pane.activeId;
    if (activeId === id) {
      activeId = (tabs[index] ?? tabs[index - 1])?.id ?? null;
    }
    return { ...pane, tabs, activeId };
  });
  return replacePanes(state, found.dock, collapseEmpty(panes));
}

/** Przenosi zakładkę do wskazanego doku/panelu (domyślnie ostatni panel celu). */
export function moveTab(
  state: DocksState,
  id: string,
  targetDock: DockId,
  targetPaneId?: string,
): DocksState {
  const found = findTab(state, id);
  if (!found) {
    return state;
  }
  const targetPanes = state[targetDock].panes;
  const resolvedTarget =
    targetPaneId && targetPanes.some((pane) => pane.id === targetPaneId)
      ? targetPaneId
      : targetPanes[targetPanes.length - 1]?.id;
  if (found.dock === targetDock && found.paneId === resolvedTarget) {
    return activateTab(state, targetDock, found.paneId, id);
  }
  const without = closeTab(state, id);
  // Panel docelowy mógł zniknąć tylko, gdy był źródłowym (obsłużone wyżej).
  return addTab(without, targetDock, found.tab, resolvedTarget);
}

/**
 * Wydziela zakładkę do NOWEGO panelu tuż za panelem źródłowym.
 * Wymaga ≥2 zakładek w panelu źródłowym (inaczej podział nic nie zmienia).
 */
export function splitPane(state: DocksState, tabId: string, newPaneId: string): DocksState {
  const found = findTab(state, tabId);
  if (!found) {
    return state;
  }
  const sourcePane = state[found.dock].panes.find((pane) => pane.id === found.paneId);
  if (!sourcePane || sourcePane.tabs.length < 2) {
    return state;
  }
  const without = closeTab(state, tabId);
  const panes = [...without[found.dock].panes];
  const sourceIndex = panes.findIndex((pane) => pane.id === found.paneId);
  panes.splice(sourceIndex + 1, 0, {
    id: newPaneId,
    tabs: [found.tab],
    activeId: found.tab.id,
  });
  return replacePanes(without, found.dock, panes);
}

/**
 * Przenosi zakładkę do NOWEGO panelu obok wskazanego (M77): upuszczenie karty
 * przy krawędzi panelu dzieli dok. W odróżnieniu od `splitPane` działa też dla
 * karty z innego panelu albo z drugiego doku i nie wymaga dwóch zakładek —
 * decyduje miejsce upuszczenia, nie liczba kart. Panel, z którego karta była
 * ostatnią, znika (`closeTab` sprząta puste panele).
 */
export function moveTabToNewPane(
  state: DocksState,
  tabId: string,
  dock: DockId,
  anchorPaneId: string,
  side: 'before' | 'after',
  newPaneId: string,
): DocksState {
  const found = findTab(state, tabId);
  if (!found || state[dock].panes.every((pane) => pane.id !== anchorPaneId)) {
    return state;
  }
  const sourcePane = state[found.dock].panes.find((pane) => pane.id === found.paneId);
  // Jedyna karta w panelu nie ma po co wyjeżdżać na jego własną krawędź.
  if (sourcePane?.id === anchorPaneId && sourcePane.tabs.length < 2) {
    return state;
  }
  const without = closeTab(state, tabId);
  const panes = [...without[dock].panes];
  const anchorIndex = panes.findIndex((pane) => pane.id === anchorPaneId);
  const at = anchorIndex === -1 ? panes.length : anchorIndex + (side === 'after' ? 1 : 0);
  panes.splice(at, 0, { id: newPaneId, tabs: [found.tab], activeId: found.tab.id });
  return replacePanes(without, dock, panes);
}

/**
 * Wstawia nowy, pusty panel tuż za wskazanym — podział przestrzeni doku
 * pod świeżą sesję. Bez limitu: każdy panel można dzielić dalej.
 */
export function insertPaneAfter(
  state: DocksState,
  dock: DockId,
  afterPaneId: string,
  newPaneId: string,
): DocksState {
  const panes = state[dock].panes;
  if (panes.some((pane) => pane.id === newPaneId)) {
    return state;
  }
  const index = panes.findIndex((pane) => pane.id === afterPaneId);
  const next = [...panes];
  next.splice(index === -1 ? next.length : index + 1, 0, emptyPane(newPaneId));
  return replacePanes(state, dock, next);
}

export function updateTab(state: DocksState, id: string, patch: Partial<DockTab>): DocksState {
  const found = findTab(state, id);
  if (!found) {
    return state;
  }
  return replacePanes(
    state,
    found.dock,
    state[found.dock].panes.map((pane) =>
      pane.id === found.paneId
        ? {
            ...pane,
            tabs: pane.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
          }
        : pane,
    ),
  );
}

export function allTabs(state: DocksState): DockTab[] {
  return DOCK_IDS.flatMap((dock) => state[dock].panes.flatMap((pane) => pane.tabs));
}

/** Aktywne zakładki wszystkich paneli (kolejność: prawy dok, potem dolny). */
export function activeTabs(state: DocksState): DockTab[] {
  return DOCK_IDS.flatMap((dock) =>
    state[dock].panes.flatMap((pane) => {
      const active = pane.tabs.find((tab) => tab.id === pane.activeId);
      return active ? [active] : [];
    }),
  );
}
