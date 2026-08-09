import { useCallback, useRef, useState, type ReactElement } from 'react';
import { clampSize, type LayoutSizeKey, type LayoutState } from '../../../shared/layout';
import { Dock } from './Dock';
import { EditorArea } from './EditorArea';
import { Sidebar } from './Sidebar';
import { Splitter } from './Splitter';

const SPLITTER_SIZE = 5;
const MIN_CENTER_WIDTH = 320;
const MIN_EDITOR_HEIGHT = 160;

export function Workbench({ initialLayout }: { initialLayout: LayoutState }): ReactElement {
  const [layout, setLayout] = useState(initialLayout);
  // Lustro stanu aktualizowane synchronicznie — handlery wskaźnika nie mogą
  // czekać na cykl renderowania Reacta.
  const layoutRef = useRef(initialLayout);
  const dragOrigin = useRef<LayoutState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((patch: Partial<LayoutState>) => {
    layoutRef.current = { ...layoutRef.current, ...patch };
    setLayout(layoutRef.current);
  }, []);

  const containerLimit = useCallback((key: LayoutSizeKey): number => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return Number.POSITIVE_INFINITY;
    }
    const current = layoutRef.current;
    switch (key) {
      case 'sidebarWidth':
        return rect.width - current.rightDockWidth - 2 * SPLITTER_SIZE - MIN_CENTER_WIDTH;
      case 'rightDockWidth':
        return rect.width - current.sidebarWidth - 2 * SPLITTER_SIZE - MIN_CENTER_WIDTH;
      case 'bottomDockHeight':
        return rect.height - SPLITTER_SIZE - MIN_EDITOR_HEIGHT;
    }
  }, []);

  const resize = useCallback(
    (key: LayoutSizeKey, desired: number) => {
      apply({ [key]: clampSize(key, Math.min(desired, containerLimit(key))) });
    },
    [apply, containerLimit],
  );

  const beginDrag = useCallback(() => {
    dragOrigin.current = layoutRef.current;
  }, []);

  const endDrag = useCallback(() => {
    dragOrigin.current = null;
    void window.api.setLayout(layoutRef.current);
  }, []);

  const origin = (): LayoutState => dragOrigin.current ?? layoutRef.current;

  return (
    <div className="shell">
      <header className="titlebar">VisualN3O</header>
      <div
        className="workbench"
        data-testid="workbench"
        ref={rootRef}
        style={{
          gridTemplateColumns: `${layout.sidebarWidth}px ${SPLITTER_SIZE}px minmax(0, 1fr) ${SPLITTER_SIZE}px ${layout.rightDockWidth}px`,
        }}
      >
        <Sidebar />
        <Splitter
          orientation="vertical"
          testId="splitter-sidebar"
          onDragStart={beginDrag}
          onDrag={(dx) => resize('sidebarWidth', origin().sidebarWidth + dx)}
          onDragEnd={endDrag}
        />
        <div
          className="center"
          style={{
            gridTemplateRows: `minmax(0, 1fr) ${SPLITTER_SIZE}px ${layout.bottomDockHeight}px`,
          }}
        >
          <EditorArea />
          <Splitter
            orientation="horizontal"
            testId="splitter-bottom"
            onDragStart={beginDrag}
            onDrag={(_dx, dy) => resize('bottomDockHeight', origin().bottomDockHeight - dy)}
            onDragEnd={endDrag}
          />
          <Dock id="bottom" title="Dolny dok" />
        </div>
        <Splitter
          orientation="vertical"
          testId="splitter-right"
          onDragStart={beginDrag}
          onDrag={(dx) => resize('rightDockWidth', origin().rightDockWidth - dx)}
          onDragEnd={endDrag}
        />
        <Dock id="right" title="Prawy dok" />
      </div>
    </div>
  );
}
