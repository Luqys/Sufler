import { describe, expect, it } from 'vitest';
import {
  activateTabInGroup,
  activeGroup,
  allOpenPaths,
  closeTabInGroup,
  groupsWithPath,
  initialGroupsState,
  openTabInActiveGroup,
  pinTabEverywhere,
  reorderTabInGroup,
  setActiveGroup,
  splitGroup,
  type EditorGroupsState,
} from '../src/shared/editor-groups';

function stateWithTwoFiles(): EditorGroupsState {
  let state = initialGroupsState();
  state = openTabInActiveGroup(state, '/a.ts', 'a.ts', true);
  state = openTabInActiveGroup(state, '/b.ts', 'b.ts', true);
  return state;
}

describe('splitGroup', () => {
  it('klonuje aktywną zakładkę do nowej grupy tuż za źródłową i ją uaktywnia', () => {
    const state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    expect(state.groups.map((group) => group.id)).toEqual(['group-1', 'group-2']);
    expect(state.activeGroupId).toBe('group-2');
    expect(state.groups[1].tabs.map((tab) => tab.path)).toEqual(['/b.ts']);
    expect(state.groups[1].activePath).toBe('/b.ts');
    // Klon jest przypięty — kolejny podgląd go nie zastąpi.
    expect(state.groups[1].tabs[0].pinned).toBe(true);
    // Źródłowa grupa zachowuje wszystkie swoje zakładki.
    expect(state.groups[0].tabs.map((tab) => tab.path)).toEqual(['/a.ts', '/b.ts']);
  });

  it('podział można powtarzać bez ograniczeń — także w środku szeregu', () => {
    let state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    state = splitGroup(state, 'group-1', 'group-3');
    expect(state.groups.map((group) => group.id)).toEqual(['group-1', 'group-3', 'group-2']);
    state = splitGroup(state, 'group-3', 'group-4');
    expect(state.groups.map((group) => group.id)).toEqual([
      'group-1',
      'group-3',
      'group-4',
      'group-2',
    ]);
    expect(state.activeGroupId).toBe('group-4');
  });

  it('pusta grupa dzieli się na pustą grupę obok', () => {
    const state = splitGroup(initialGroupsState(), 'group-1', 'group-2');
    expect(state.groups).toHaveLength(2);
    expect(state.groups[1].tabs).toEqual([]);
    expect(state.activeGroupId).toBe('group-2');
  });

  it('nie robi nic dla nieznanej grupy ani zdublowanego id', () => {
    const state = stateWithTwoFiles();
    expect(splitGroup(state, 'group-x', 'group-2')).toBe(state);
    expect(splitGroup(state, 'group-1', 'group-1')).toBe(state);
  });
});

describe('closeTabInGroup', () => {
  it('opróżniona grupa znika, aktywność wraca do sąsiada', () => {
    let state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    state = closeTabInGroup(state, 'group-2', '/b.ts');
    expect(state.groups.map((group) => group.id)).toEqual(['group-1']);
    expect(state.activeGroupId).toBe('group-1');
  });

  it('ostatnia grupa zostaje nawet pusta', () => {
    let state = initialGroupsState();
    state = openTabInActiveGroup(state, '/a.ts', 'a.ts', true);
    state = closeTabInGroup(state, 'group-1', '/a.ts');
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0].tabs).toEqual([]);
  });

  it('zamknięcie w nieaktywnej grupie nie przełącza aktywnej', () => {
    let state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    state = openTabInActiveGroup(state, '/c.ts', 'c.ts', true);
    state = setActiveGroup(state, 'group-1');
    state = closeTabInGroup(state, 'group-2', '/b.ts');
    state = closeTabInGroup(state, 'group-2', '/c.ts');
    expect(state.groups.map((group) => group.id)).toEqual(['group-1']);
    expect(state.activeGroupId).toBe('group-1');
  });
});

describe('otwieranie i aktywacja', () => {
  it('openTabInActiveGroup trafia do aktywnej grupy', () => {
    let state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    state = openTabInActiveGroup(state, '/c.ts', 'c.ts', true);
    expect(state.groups[1].tabs.map((tab) => tab.path)).toEqual(['/b.ts', '/c.ts']);
    expect(state.groups[0].tabs.map((tab) => tab.path)).toEqual(['/a.ts', '/b.ts']);
  });

  it('activateTabInGroup uaktywnia zakładkę razem z grupą', () => {
    let state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    state = activateTabInGroup(state, 'group-1', '/a.ts');
    expect(state.activeGroupId).toBe('group-1');
    expect(activeGroup(state).activePath).toBe('/a.ts');
  });

  it('ten sam plik może być otwarty w dwóch grupach naraz', () => {
    const state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    expect(groupsWithPath(state, '/b.ts')).toBe(2);
    expect(allOpenPaths(state).sort()).toEqual(['/a.ts', '/b.ts']);
  });
});

describe('pin i kolejność', () => {
  it('pinTabEverywhere przypina podglądy we wszystkich grupach', () => {
    let state = initialGroupsState();
    state = openTabInActiveGroup(state, '/a.ts', 'a.ts', false);
    state = splitGroup(state, 'group-1', 'group-2');
    // Podgląd w group-1 nadal nieprzypięty; klon w group-2 przypięty z natury.
    state = pinTabEverywhere(state, '/a.ts');
    for (const group of state.groups) {
      expect(group.tabs[0].pinned).toBe(true);
    }
  });

  it('reorderTabInGroup działa tylko we wskazanej grupie', () => {
    let state = splitGroup(stateWithTwoFiles(), 'group-1', 'group-2');
    state = reorderTabInGroup(state, 'group-1', '/b.ts', '/a.ts');
    expect(state.groups[0].tabs.map((tab) => tab.path)).toEqual(['/b.ts', '/a.ts']);
    expect(state.groups[1].tabs.map((tab) => tab.path)).toEqual(['/b.ts']);
  });
});
