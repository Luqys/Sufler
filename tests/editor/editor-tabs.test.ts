import { describe, expect, it } from 'vitest';
import {
  activateTab,
  closeTab,
  emptyTabsState,
  openTab,
  pinTab,
  reorderTab,
  type EditorTabsState,
} from '../../src/shared/editor/editor-tabs';

function state(tabs: Array<[string, boolean]>, activePath: string | null): EditorTabsState {
  return {
    tabs: tabs.map(([path, pinned]) => ({ path, title: path, pinned })),
    activePath,
  };
}

describe('openTab', () => {
  it('otwiera pierwszą zakładkę jako aktywną', () => {
    const result = openTab(emptyTabsState, '/a', 'a', false);
    expect(result.tabs).toHaveLength(1);
    expect(result.activePath).toBe('/a');
    expect(result.tabs[0]?.pinned).toBe(false);
  });

  it('podgląd zastępuje istniejący podgląd w miejscu', () => {
    const before = state([['/a', false]], '/a');
    const result = openTab(before, '/b', 'b', false);
    expect(result.tabs.map((tab) => tab.path)).toEqual(['/b']);
    expect(result.activePath).toBe('/b');
  });

  it('podgląd nie zastępuje zakładki przypiętej', () => {
    const before = state([['/a', true]], '/a');
    const result = openTab(before, '/b', 'b', false);
    expect(result.tabs.map((tab) => tab.path)).toEqual(['/a', '/b']);
  });

  it('otwarcie przypięte dokłada zakładkę obok podglądu', () => {
    const before = state([['/a', false]], '/a');
    const result = openTab(before, '/b', 'b', true);
    expect(result.tabs.map((tab) => tab.path)).toEqual(['/a', '/b']);
    expect(result.tabs[1]?.pinned).toBe(true);
  });

  it('ponowne otwarcie istniejącej aktywuje, a pinned=true przypina podgląd', () => {
    const before = state([['/a', false], ['/b', true]], '/b');
    const activated = openTab(before, '/a', 'a', false);
    expect(activated.activePath).toBe('/a');
    expect(activated.tabs).toHaveLength(2);
    const pinned = openTab(before, '/a', 'a', true);
    expect(pinned.tabs[0]?.pinned).toBe(true);
  });
});

describe('activateTab', () => {
  it('aktywuje istniejącą zakładkę i ignoruje nieznaną', () => {
    const before = state([['/a', true], ['/b', true]], '/a');
    expect(activateTab(before, '/b').activePath).toBe('/b');
    expect(activateTab(before, '/x')).toBe(before);
  });
});

describe('pinTab', () => {
  it('przypina podgląd i nie zmienia aktywnej', () => {
    const before = state([['/a', false]], '/a');
    const result = pinTab(before, '/a');
    expect(result.tabs[0]?.pinned).toBe(true);
    expect(result.activePath).toBe('/a');
  });

  it('nic nie robi dla już przypiętej', () => {
    const before = state([['/a', true]], '/a');
    expect(pinTab(before, '/a')).toBe(before);
  });
});

describe('reorderTab', () => {
  it('przenosi zakładkę na pozycję docelowej (w przód i w tył)', () => {
    const before = state([['/a', true], ['/b', true], ['/c', true]], '/a');
    expect(reorderTab(before, '/a', '/c').tabs.map((tab) => tab.path)).toEqual([
      '/b',
      '/c',
      '/a',
    ]);
    expect(reorderTab(before, '/c', '/a').tabs.map((tab) => tab.path)).toEqual([
      '/c',
      '/a',
      '/b',
    ]);
  });

  it('nie zmienia aktywnej zakładki', () => {
    const before = state([['/a', true], ['/b', true]], '/b');
    expect(reorderTab(before, '/b', '/a').activePath).toBe('/b');
  });

  it('ignoruje nieznane ścieżki i przeciągnięcie na siebie', () => {
    const before = state([['/a', true], ['/b', true]], '/a');
    expect(reorderTab(before, '/a', '/x')).toBe(before);
    expect(reorderTab(before, '/x', '/a')).toBe(before);
    expect(reorderTab(before, '/a', '/a')).toBe(before);
  });
});

describe('closeTab', () => {
  it('zamknięcie aktywnej wybiera sąsiada z prawej, potem z lewej', () => {
    const three = state([['/a', true], ['/b', true], ['/c', true]], '/b');
    expect(closeTab(three, '/b').activePath).toBe('/c');
    const last = state([['/a', true], ['/b', true]], '/b');
    expect(closeTab(last, '/b').activePath).toBe('/a');
  });

  it('zamknięcie nieaktywnej nie zmienia aktywnej', () => {
    const before = state([['/a', true], ['/b', true]], '/a');
    expect(closeTab(before, '/b').activePath).toBe('/a');
  });

  it('zamknięcie ostatniej zeruje aktywną', () => {
    const before = state([['/a', true]], '/a');
    const result = closeTab(before, '/a');
    expect(result.tabs).toHaveLength(0);
    expect(result.activePath).toBeNull();
  });
});
