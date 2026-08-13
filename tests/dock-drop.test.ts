import { describe, expect, it } from 'vitest';
import { dropZoneFor, EDGE_RATIO, MIN_SPLIT_SIZE } from '../src/shared/dock-drop';
import {
  addTab,
  emptyDocksState,
  findTab,
  moveTabToNewPane,
  type DockTab,
} from '../src/shared/dock-tabs';

const RECT = { x: 100, y: 50, width: 400, height: 200 };

function tab(id: string): DockTab {
  return { id, kind: 'claude', title: id, cwd: '/p', ptyId: Number(id.slice(-1)), status: 'running' };
}

describe('dropZoneFor', () => {
  it('dolny dok dzieli się w poziomie: lewa i prawa krawędź', () => {
    expect(dropZoneFor('bottom', RECT, { x: 110, y: 150 })).toBe('before');
    expect(dropZoneFor('bottom', RECT, { x: 490, y: 150 })).toBe('after');
    expect(dropZoneFor('bottom', RECT, { x: 300, y: 150 })).toBe('center');
  });

  it('prawy dok dzieli się w pionie: górna i dolna krawędź', () => {
    expect(dropZoneFor('right', RECT, { x: 300, y: 55 })).toBe('before');
    expect(dropZoneFor('right', RECT, { x: 300, y: 245 })).toBe('after');
    expect(dropZoneFor('right', RECT, { x: 300, y: 150 })).toBe('center');
    // Ta sama pozycja X, która w dolnym doku dzieliła, tu jest środkiem.
    expect(dropZoneFor('right', RECT, { x: 110, y: 150 })).toBe('center');
  });

  it('granica strefy wypada dokładnie na zadanym udziale krawędzi', () => {
    const edge = RECT.width * EDGE_RATIO;
    expect(dropZoneFor('bottom', RECT, { x: RECT.x + edge, y: 150 })).toBe('before');
    expect(dropZoneFor('bottom', RECT, { x: RECT.x + edge + 1, y: 150 })).toBe('center');
  });

  it('mały panel nie dzieli się wcale', () => {
    const tiny = { x: 0, y: 0, width: MIN_SPLIT_SIZE - 1, height: 40 };
    expect(dropZoneFor('bottom', tiny, { x: 1, y: 20 })).toBe('center');
  });

  it('kursor poza panelem to środek, nie krawędź', () => {
    expect(dropZoneFor('bottom', RECT, { x: 40, y: 150 })).toBe('center');
    expect(dropZoneFor('bottom', RECT, { x: 900, y: 150 })).toBe('center');
  });
});

describe('moveTabToNewPane', () => {
  const base = addTab(addTab(emptyDocksState, 'bottom', tab('t1')), 'bottom', tab('t2'));

  it('karta z panelu o dwóch zakładkach wyjeżdża do nowego panelu obok', () => {
    const next = moveTabToNewPane(base, 't2', 'bottom', 'bottom-1', 'after', 'pane-2');
    expect(next.bottom.panes.map((pane) => pane.id)).toEqual(['bottom-1', 'pane-2']);
    expect(next.bottom.panes[1]?.tabs.map((entry) => entry.id)).toEqual(['t2']);
    expect(next.bottom.panes[1]?.activeId).toBe('t2');
    expect(next.bottom.panes[0]?.tabs.map((entry) => entry.id)).toEqual(['t1']);
  });

  it('strona „before" wstawia panel przed zakotwiczonym', () => {
    const next = moveTabToNewPane(base, 't2', 'bottom', 'bottom-1', 'before', 'pane-2');
    expect(next.bottom.panes.map((pane) => pane.id)).toEqual(['pane-2', 'bottom-1']);
  });

  it('ostatnia karta panelu nie dzieli własnego panelu', () => {
    const single = addTab(emptyDocksState, 'bottom', tab('t9'));
    expect(moveTabToNewPane(single, 't9', 'bottom', 'bottom-1', 'after', 'pane-2')).toBe(single);
  });

  it('karta z drugiego doku ląduje w nowym panelu, a jej panel znika', () => {
    const across = addTab(base, 'right', tab('t3'));
    const next = moveTabToNewPane(across, 't3', 'bottom', 'bottom-1', 'after', 'pane-2');
    expect(findTab(next, 't3')?.dock).toBe('bottom');
    expect(findTab(next, 't3')?.paneId).toBe('pane-2');
    // Prawy dok zostaje z jednym, pustym panelem (ostatni nigdy nie znika).
    expect(next.right.panes).toHaveLength(1);
    expect(next.right.panes[0]?.tabs).toHaveLength(0);
  });

  it('nieznana karta albo nieznany panel nie zmieniają stanu', () => {
    expect(moveTabToNewPane(base, 'nie-ma', 'bottom', 'bottom-1', 'after', 'pane-2')).toBe(base);
    expect(moveTabToNewPane(base, 't2', 'bottom', 'nie-ma', 'after', 'pane-2')).toBe(base);
  });
});
