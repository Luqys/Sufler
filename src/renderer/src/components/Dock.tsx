import { useState, type DragEvent, type ReactElement } from 'react';
import type { DockId, DockPane } from '../../../shared/dock-tabs';
import { useDocks } from '../docks';
import { TerminalView } from './TerminalView';

const DND_MIME = 'application/x-visualn3o-tab';

const ICON_SPLIT = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.6" />
    <path d="M8 2.6v10.8" />
  </svg>
);

const ICON_NEW_CLAUDE = (
  <svg width="15" height="15" viewBox="0 0 16 16">
    <text
      x="8"
      y="12.4"
      textAnchor="middle"
      fontSize="12"
      fontWeight={700}
      fill="#d97757"
      fontFamily="-apple-system, sans-serif"
    >
      ✳
    </text>
  </svg>
);

const ICON_NEW_TERMINAL = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5l4 4-4 4" />
    <path d="M8.5 12h5" />
  </svg>
);

interface PaneViewProps {
  dockId: DockId;
  pane: DockPane;
  paneIndex: number;
  title: string;
}

/** Jeden panel doku: własny pasek zakładek, [+], podział i terminal aktywnej karty. */
function PaneView({ dockId, pane, paneIndex, title }: PaneViewProps): ReactElement {
  const { addTab, activateTab, closeTab, moveTab, splitTab, detachTab } = useDocks();
  const [dropHover, setDropHover] = useState(false);

  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeId) ?? null;
  const first = paneIndex === 0;

  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes(DND_MIME)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      setDropHover(true);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const tabId = event.dataTransfer.getData(DND_MIME);
    if (tabId) {
      event.preventDefault();
      event.stopPropagation();
      moveTab(tabId, dockId, pane.id);
    }
    setDropHover(false);
  };

  return (
    <div
      className={`dock-pane${dropHover ? ' drop-target' : ''}`}
      data-testid={`${dockId}-pane-${paneIndex}`}
      onDragOver={onDragOver}
      onDragLeave={() => setDropHover(false)}
      onDrop={onDrop}
    >
      <header className="dock-header">
        <div className="dock-tabs">
          {pane.tabs.length === 0 && <span className="dock-title">{title}</span>}
          {pane.tabs.map((tab) => (
            <div
              key={tab.id}
              className={`dock-tab${tab.id === pane.activeId ? ' active' : ''}${
                tab.status === 'exited' ? ' exited' : ''
              }`}
              draggable
              data-status={tab.status}
              title={`${tab.title} — ${tab.cwd}`}
              onClick={() => activateTab(dockId, pane.id, tab.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData(DND_MIME, tab.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={(event) => {
                // Upuszczenie poza oknem → sesja wyjeżdża do osobnego okna.
                const margin = 40;
                const outside =
                  event.screenX < window.screenX - margin ||
                  event.screenX > window.screenX + window.outerWidth + margin ||
                  event.screenY < window.screenY - margin ||
                  event.screenY > window.screenY + window.outerHeight + margin;
                if (outside && (event.screenX !== 0 || event.screenY !== 0)) {
                  detachTab(tab.id);
                }
              }}
            >
              {tab.kind === 'claude' &&
                tab.id !== pane.activeId &&
                (tab.status === 'idle' || tab.status === 'needs-input') && (
                  <span
                    className={`status-dot ${tab.status === 'idle' ? 'done' : 'attention'}`}
                    title={
                      tab.status === 'idle' ? 'Claude skończył pracę' : 'Claude czeka na zgodę'
                    }
                  />
                )}
              <span className="dock-tab-title">{tab.title}</span>
              <button
                type="button"
                className="tab-close"
                title="Zamknij zakładkę"
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="dock-add-wrap">
          {pane.tabs.length >= 2 && activeTab && (
            <button
              type="button"
              className="dock-add"
              data-testid={first ? `${dockId}-pane-split` : undefined}
              title="Podziel: wydziel aktywną kartę do panelu obok"
              onClick={() => splitTab(activeTab.id)}
            >
              {ICON_SPLIT}
            </button>
          )}
          <button
            type="button"
            className="dock-add"
            data-testid={first ? `${dockId}-new-claude` : undefined}
            title="Nowa sesja Claude w tym panelu"
            onClick={() => addTab(dockId, 'claude', { paneId: pane.id })}
          >
            {ICON_NEW_CLAUDE}
          </button>
          <button
            type="button"
            className="dock-add"
            data-testid={first ? `${dockId}-new-terminal` : undefined}
            title="Nowy terminal w tym panelu"
            onClick={() => addTab(dockId, 'terminal', { paneId: pane.id })}
          >
            {ICON_NEW_TERMINAL}
          </button>
        </div>
      </header>
      <div className="dock-body">
        {activeTab ? (
          <TerminalView key={activeTab.id} tabId={activeTab.id} />
        ) : (
          <div className="dock-empty">
            <p className="placeholder">Kliknij +, aby otworzyć terminal lub sesję Claude.</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface DockProps {
  id: DockId;
  title: string;
}

/**
 * Wspólny komponent obu doków (SPEC.md): dolny dzieli się na kolumny,
 * prawy na wiersze. Zakładki `terminal` i `claude` różnią się wyłącznie
 * komendą startową pty.
 */
export function Dock({ id, title }: DockProps): ReactElement {
  const { docks, moveTab } = useDocks();
  const dock = docks[id];

  // Fallback: upuszczenie poza panelami (np. pusty margines) → ostatni panel.
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const tabId = event.dataTransfer.getData(DND_MIME);
    if (tabId) {
      event.preventDefault();
      moveTab(tabId, id);
    }
  };

  return (
    <section
      className={`dock dock-${id}`}
      data-testid={`${id}-dock`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(DND_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={onDrop}
    >
      <div className={`dock-panes ${id === 'bottom' ? 'panes-row' : 'panes-column'}`}>
        {dock.panes.map((pane, index) => (
          <PaneView key={pane.id} dockId={id} pane={pane} paneIndex={index} title={title} />
        ))}
      </div>
    </section>
  );
}
