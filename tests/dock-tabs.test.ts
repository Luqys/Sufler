import { describe, expect, it } from 'vitest';
import {
  activateTab,
  addTab,
  allTabs,
  closeTab,
  emptyDocksState,
  findTab,
  moveTab,
  updateTab,
  type DockTab,
  type DocksState,
} from '../src/shared/dock-tabs';

function tab(id: string, ptyId = 1): DockTab {
  return { id, kind: 'terminal', title: 'zsh', cwd: '/tmp', ptyId, status: 'running' };
}

describe('addTab / activateTab', () => {
  it('dodaje zakładkę i aktywuje ją w danym doku', () => {
    const state = addTab(emptyDocksState, 'bottom', tab('a'));
    expect(state.bottom.tabs).toHaveLength(1);
    expect(state.bottom.activeId).toBe('a');
    expect(state.right.tabs).toHaveLength(0);
  });

  it('aktywuje tylko istniejące zakładki', () => {
    const state = addTab(emptyDocksState, 'bottom', tab('a'));
    expect(activateTab(state, 'bottom', 'x')).toBe(state);
    const two = addTab(state, 'bottom', tab('b', 2));
    expect(activateTab(two, 'bottom', 'a').bottom.activeId).toBe('a');
  });
});

describe('closeTab', () => {
  it('zamyka i wybiera sąsiada', () => {
    let state: DocksState = emptyDocksState;
    state = addTab(state, 'bottom', tab('a', 1));
    state = addTab(state, 'bottom', tab('b', 2));
    state = addTab(state, 'bottom', tab('c', 3));
    state = activateTab(state, 'bottom', 'b');
    const closed = closeTab(state, 'b');
    expect(closed.bottom.tabs.map((t) => t.id)).toEqual(['a', 'c']);
    expect(closed.bottom.activeId).toBe('c');
  });

  it('zamknięcie ostatniej zeruje aktywną', () => {
    const state = addTab(emptyDocksState, 'right', tab('a'));
    const closed = closeTab(state, 'a');
    expect(closed.right.tabs).toHaveLength(0);
    expect(closed.right.activeId).toBeNull();
  });
});

describe('moveTab', () => {
  it('przenosi zakładkę między dokami z zachowaniem ptyId i aktywuje w celu', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a', 7));
    state = addTab(state, 'bottom', tab('b', 8));
    const moved = moveTab(state, 'a', 'right');
    expect(moved.bottom.tabs.map((t) => t.id)).toEqual(['b']);
    expect(moved.right.tabs.map((t) => t.id)).toEqual(['a']);
    expect(moved.right.activeId).toBe('a');
    expect(findTab(moved, 'a')?.tab.ptyId).toBe(7);
  });

  it('przeniesienie do tego samego doku tylko aktywuje', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a'));
    state = addTab(state, 'bottom', tab('b', 2));
    const moved = moveTab(state, 'a', 'bottom');
    expect(moved.bottom.tabs).toHaveLength(2);
    expect(moved.bottom.activeId).toBe('a');
  });

  it('po przeniesieniu aktywnej dok źródłowy wybiera sąsiada', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a'));
    state = addTab(state, 'bottom', tab('b', 2));
    const moved = moveTab(state, 'b', 'right');
    expect(moved.bottom.activeId).toBe('a');
  });
});

describe('updateTab / allTabs', () => {
  it('aktualizuje status zakładki tam, gdzie jest', () => {
    let state = addTab(emptyDocksState, 'right', tab('a'));
    state = updateTab(state, 'a', { status: 'exited' });
    expect(state.right.tabs[0]?.status).toBe('exited');
    expect(allTabs(state).map((t) => t.id)).toEqual(['a']);
  });
});
