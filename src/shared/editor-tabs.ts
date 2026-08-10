/**
 * Czysta logika zakładek edytora (semantyka podglądu jak w VS Code):
 * pojedyncze kliknięcie otwiera zakładkę-podgląd (zastępowaną przez kolejny
 * podgląd), podwójne — przypina. Edycja podglądu przypina go automatycznie
 * (obsługiwane wyżej, w warstwie workspace).
 */

export interface EditorTabDescriptor {
  path: string;
  title: string;
  pinned: boolean;
}

export interface EditorTabsState {
  tabs: EditorTabDescriptor[];
  activePath: string | null;
}

export const emptyTabsState: EditorTabsState = { tabs: [], activePath: null };

export function openTab(
  state: EditorTabsState,
  path: string,
  title: string,
  pinned: boolean,
): EditorTabsState {
  const existing = state.tabs.find((tab) => tab.path === path);
  if (existing) {
    const tabs =
      pinned && !existing.pinned
        ? state.tabs.map((tab) => (tab.path === path ? { ...tab, pinned: true } : tab))
        : state.tabs;
    return { tabs, activePath: path };
  }
  const tab: EditorTabDescriptor = { path, title, pinned };
  if (!pinned) {
    const previewIndex = state.tabs.findIndex((candidate) => !candidate.pinned);
    if (previewIndex !== -1) {
      const tabs = [...state.tabs];
      tabs[previewIndex] = tab;
      return { tabs, activePath: path };
    }
  }
  return { tabs: [...state.tabs, tab], activePath: path };
}

export function activateTab(state: EditorTabsState, path: string): EditorTabsState {
  if (!state.tabs.some((tab) => tab.path === path)) {
    return state;
  }
  return { tabs: state.tabs, activePath: path };
}

export function pinTab(state: EditorTabsState, path: string): EditorTabsState {
  if (!state.tabs.some((tab) => tab.path === path && !tab.pinned)) {
    return state;
  }
  return {
    tabs: state.tabs.map((tab) => (tab.path === path ? { ...tab, pinned: true } : tab)),
    activePath: state.activePath,
  };
}

/** Przenosi zakładkę na pozycję zakładki docelowej (przeciąganie w pasku). */
export function reorderTab(
  state: EditorTabsState,
  fromPath: string,
  toPath: string,
): EditorTabsState {
  if (fromPath === toPath) {
    return state;
  }
  const fromIndex = state.tabs.findIndex((tab) => tab.path === fromPath);
  const toIndex = state.tabs.findIndex((tab) => tab.path === toPath);
  if (fromIndex === -1 || toIndex === -1) {
    return state;
  }
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(fromIndex, 1);
  tabs.splice(toIndex, 0, moved);
  return { tabs, activePath: state.activePath };
}

export function closeTab(state: EditorTabsState, path: string): EditorTabsState {
  const index = state.tabs.findIndex((tab) => tab.path === path);
  if (index === -1) {
    return state;
  }
  const tabs = state.tabs.filter((tab) => tab.path !== path);
  let activePath = state.activePath;
  if (state.activePath === path) {
    activePath = (tabs[index] ?? tabs[index - 1])?.path ?? null;
  }
  return { tabs, activePath };
}
