import { describe, expect, it } from 'vitest';
import {
  activateTab,
  activeTabs,
  addTab,
  allTabs,
  closeTab,
  emptyDocksState,
  findTab,
  insertPaneAfter,
  moveTab,
  splitPane,
  updateTab,
  type DockTab,
  type DocksState,
} from '../../src/shared/docks/dock-tabs';

function tab(id: string, ptyId = 1): DockTab {
  return { id, kind: 'terminal', title: 'zsh', cwd: '/tmp', ptyId, status: 'running' };
}

describe('addTab / activateTab', () => {
  it('dodaje do ostatniego panelu doku i aktywuje', () => {
    const state = addTab(emptyDocksState, 'bottom', tab('a'));
    expect(state.bottom.panes).toHaveLength(1);
    expect(state.bottom.panes[0]?.tabs.map((t) => t.id)).toEqual(['a']);
    expect(state.bottom.panes[0]?.activeId).toBe('a');
    expect(state.right.panes[0]?.tabs).toHaveLength(0);
  });

  it('dodaje do wskazanego panelu', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a'));
    state = addTab(state, 'bottom', tab('b', 2));
    state = splitPane(state, 'b', 'pane-x');
    state = addTab(state, 'bottom', tab('c', 3), 'bottom-1');
    expect(state.bottom.panes[0]?.tabs.map((t) => t.id)).toEqual(['a', 'c']);
    expect(state.bottom.panes[1]?.tabs.map((t) => t.id)).toEqual(['b']);
  });

  it('aktywuje w konkretnym panelu', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a'));
    state = addTab(state, 'bottom', tab('b', 2));
    state = activateTab(state, 'bottom', 'bottom-1', 'a');
    expect(state.bottom.panes[0]?.activeId).toBe('a');
  });
});

describe('closeTab', () => {
  it('zamyka i wybiera sąsiada', () => {
    let state: DocksState = emptyDocksState;
    state = addTab(state, 'bottom', tab('a', 1));
    state = addTab(state, 'bottom', tab('b', 2));
    state = addTab(state, 'bottom', tab('c', 3));
    state = activateTab(state, 'bottom', 'bottom-1', 'b');
    const closed = closeTab(state, 'b');
    expect(closed.bottom.panes[0]?.tabs.map((t) => t.id)).toEqual(['a', 'c']);
    expect(closed.bottom.panes[0]?.activeId).toBe('c');
  });

  it('pusty panel znika, ale ostatni panel doku zostaje', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a'));
    state = addTab(state, 'bottom', tab('b', 2));
    state = splitPane(state, 'b', 'pane-x');
    expect(state.bottom.panes).toHaveLength(2);
    const closed = closeTab(state, 'b');
    expect(closed.bottom.panes).toHaveLength(1);
    const emptied = closeTab(closed, 'a');
    expect(emptied.bottom.panes).toHaveLength(1);
    expect(emptied.bottom.panes[0]?.tabs).toHaveLength(0);
  });
});

describe('splitPane', () => {
  it('wydziela zakładkę do nowego panelu za źródłowym', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a', 7));
    state = addTab(state, 'bottom', tab('b', 8));
    const split = splitPane(state, 'b', 'pane-nowy');
    expect(split.bottom.panes.map((p) => p.id)).toEqual(['bottom-1', 'pane-nowy']);
    expect(split.bottom.panes[0]?.tabs.map((t) => t.id)).toEqual(['a']);
    expect(split.bottom.panes[1]?.tabs.map((t) => t.id)).toEqual(['b']);
    expect(split.bottom.panes[1]?.activeId).toBe('b');
    expect(findTab(split, 'b')?.tab.ptyId).toBe(8);
  });

  it('nie dzieli panelu z jedną zakładką', () => {
    const state = addTab(emptyDocksState, 'bottom', tab('a'));
    expect(splitPane(state, 'a', 'pane-x')).toBe(state);
  });
});

describe('moveTab', () => {
  it('przenosi między dokami do ostatniego panelu celu', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a', 7));
    state = addTab(state, 'bottom', tab('b', 8));
    const moved = moveTab(state, 'a', 'right');
    expect(moved.bottom.panes[0]?.tabs.map((t) => t.id)).toEqual(['b']);
    expect(moved.right.panes[0]?.tabs.map((t) => t.id)).toEqual(['a']);
    expect(moved.right.panes[0]?.activeId).toBe('a');
  });

  it('przenosi do wskazanego panelu', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a'));
    state = addTab(state, 'bottom', tab('b', 2));
    state = splitPane(state, 'b', 'pane-2');
    state = addTab(state, 'right', tab('c', 3));
    const moved = moveTab(state, 'c', 'bottom', 'pane-2');
    expect(moved.bottom.panes[1]?.tabs.map((t) => t.id)).toEqual(['b', 'c']);
    expect(moved.right.panes[0]?.tabs).toHaveLength(0);
  });

  it('ten sam panel → tylko aktywacja', () => {
    let state = addTab(emptyDocksState, 'bottom', tab('a'));
    state = addTab(state, 'bottom', tab('b', 2));
    const moved = moveTab(state, 'a', 'bottom', 'bottom-1');
    expect(moved.bottom.panes[0]?.tabs).toHaveLength(2);
    expect(moved.bottom.panes[0]?.activeId).toBe('a');
  });
});

describe('updateTab / allTabs / activeTabs', () => {
  it('aktualizuje status i listuje zakładki ze wszystkich paneli', () => {
    let state = addTab(emptyDocksState, 'right', tab('a'));
    state = addTab(state, 'right', tab('b', 2));
    state = splitPane(state, 'b', 'pane-2');
    state = updateTab(state, 'a', { status: 'exited' });
    expect(findTab(state, 'a')?.tab.status).toBe('exited');
    expect(allTabs(state).map((t) => t.id)).toEqual(['a', 'b']);
    expect(activeTabs(state).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('insertPaneAfter', () => {
  it('wstawia pusty panel tuż za wskazanym', () => {
    let state = addTab(emptyDocksState, 'right', tab('a'));
    state = addTab(state, 'right', tab('b', 2));
    state = splitPane(state, 'b', 'pane-2');
    state = insertPaneAfter(state, 'right', 'right-1', 'pane-3');
    expect(state.right.panes.map((pane) => pane.id)).toEqual(['right-1', 'pane-3', 'pane-2']);
    expect(state.right.panes[1]?.tabs).toHaveLength(0);
  });

  it('podział można powtarzać bez ograniczeń', () => {
    let state: DocksState = emptyDocksState;
    state = insertPaneAfter(state, 'right', 'right-1', 'pane-2');
    state = insertPaneAfter(state, 'right', 'pane-2', 'pane-3');
    state = insertPaneAfter(state, 'right', 'pane-2', 'pane-4');
    expect(state.right.panes.map((pane) => pane.id)).toEqual([
      'right-1',
      'pane-2',
      'pane-4',
      'pane-3',
    ]);
  });

  it('nieznany panel źródłowy → nowy panel na końcu; duplikat id → bez zmian', () => {
    const state = insertPaneAfter(emptyDocksState, 'right', 'nie-ma', 'pane-2');
    expect(state.right.panes.map((pane) => pane.id)).toEqual(['right-1', 'pane-2']);
    expect(insertPaneAfter(state, 'right', 'right-1', 'pane-2')).toBe(state);
  });
});
