/**
 * Grupy edytora (M31): podział przestrzeni roboczej na kolumny.
 * Każda grupa to niezależny zestaw zakładek (EditorTabsState) z własnym
 * paskiem; podział można powtarzać bez ograniczeń — każdą grupę wolno
 * dzielić dalej. Czysta logika bez zależności — testowana jednostkowo.
 */

import {
  activateTab,
  closeTab,
  openTab,
  pinTab,
  reorderTab,
  type EditorTabsState,
} from './editor-tabs';

export interface EditorGroup extends EditorTabsState {
  id: string;
}

export interface EditorGroupsState {
  /** Zawsze co najmniej jedna grupa. */
  groups: EditorGroup[];
  activeGroupId: string;
}

export function initialGroupsState(id = 'group-1'): EditorGroupsState {
  return { groups: [{ id, tabs: [], activePath: null }], activeGroupId: id };
}

export function activeGroup(state: EditorGroupsState): EditorGroup {
  return state.groups.find((group) => group.id === state.activeGroupId) ?? state.groups[0];
}

function replaceGroup(
  state: EditorGroupsState,
  groupId: string,
  next: EditorTabsState,
): EditorGroupsState {
  return {
    ...state,
    groups: state.groups.map((group) => (group.id === groupId ? { ...group, ...next } : group)),
  };
}

export function setActiveGroup(state: EditorGroupsState, groupId: string): EditorGroupsState {
  if (state.activeGroupId === groupId || !state.groups.some((group) => group.id === groupId)) {
    return state;
  }
  return { ...state, activeGroupId: groupId };
}

/** Otwiera zakładkę w aktywnej grupie (semantyka podglądu — per grupa). */
export function openTabInActiveGroup(
  state: EditorGroupsState,
  path: string,
  title: string,
  pinned: boolean,
): EditorGroupsState {
  const group = activeGroup(state);
  return replaceGroup(state, group.id, openTab(group, path, title, pinned));
}

/** Uaktywnia zakładkę i zarazem jej grupę. */
export function activateTabInGroup(
  state: EditorGroupsState,
  groupId: string,
  path: string,
): EditorGroupsState {
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return state;
  }
  return { ...replaceGroup(state, groupId, activateTab(group, path)), activeGroupId: groupId };
}

export function pinTabInGroup(
  state: EditorGroupsState,
  groupId: string,
  path: string,
): EditorGroupsState {
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return state;
  }
  return replaceGroup(state, groupId, pinTab(group, path));
}

/** Przypina zakładkę w każdej grupie, która ją ma (brudny podgląd nie może zniknąć). */
export function pinTabEverywhere(state: EditorGroupsState, path: string): EditorGroupsState {
  return {
    ...state,
    groups: state.groups.map((group) => ({ ...group, ...pinTab(group, path) })),
  };
}

export function reorderTabInGroup(
  state: EditorGroupsState,
  groupId: string,
  fromPath: string,
  toPath: string,
): EditorGroupsState {
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return state;
  }
  return replaceGroup(state, groupId, reorderTab(group, fromPath, toPath));
}

/** Zamyka zakładkę w grupie; opróżniona grupa znika (ostatnia zawsze zostaje). */
export function closeTabInGroup(
  state: EditorGroupsState,
  groupId: string,
  path: string,
): EditorGroupsState {
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return state;
  }
  const closed = closeTab(group, path);
  const groups = state.groups.map((candidate) =>
    candidate.id === groupId ? { ...candidate, ...closed } : candidate,
  );
  if (closed.tabs.length === 0 && groups.length > 1) {
    const index = groups.findIndex((candidate) => candidate.id === groupId);
    const remaining = groups.filter((candidate) => candidate.id !== groupId);
    const activeGroupId =
      state.activeGroupId === groupId
        ? remaining[Math.min(index, remaining.length - 1)].id
        : state.activeGroupId;
    return { groups: remaining, activeGroupId };
  }
  return { ...state, groups };
}

/**
 * Dzieli grupę: nowa grupa powstaje tuż za źródłową i przejmuje klon aktywnej
 * zakładki (przypięty). Pustą grupę też można podzielić — obok wyrasta pusta.
 */
export function splitGroup(
  state: EditorGroupsState,
  groupId: string,
  newGroupId: string,
): EditorGroupsState {
  const index = state.groups.findIndex((candidate) => candidate.id === groupId);
  if (index === -1 || state.groups.some((candidate) => candidate.id === newGroupId)) {
    return state;
  }
  const source = state.groups[index];
  const active = source.tabs.find((tab) => tab.path === source.activePath) ?? null;
  const clone: EditorGroup = active
    ? { id: newGroupId, tabs: [{ ...active, pinned: true }], activePath: active.path }
    : { id: newGroupId, tabs: [], activePath: null };
  const groups = [...state.groups];
  groups.splice(index + 1, 0, clone);
  return { groups, activeGroupId: newGroupId };
}

/** Unikalne ścieżki wszystkich grup — obserwator plików i sprzątanie modeli. */
export function allOpenPaths(state: EditorGroupsState): string[] {
  return [...new Set(state.groups.flatMap((group) => group.tabs.map((tab) => tab.path)))];
}

/** Liczba grup zawierających ścieżkę — model sprzątamy dopiero przy ostatniej. */
export function groupsWithPath(state: EditorGroupsState, path: string): number {
  return state.groups.filter((group) => group.tabs.some((tab) => tab.path === path)).length;
}
