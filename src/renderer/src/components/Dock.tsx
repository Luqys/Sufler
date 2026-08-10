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

interface PaneViewProps {
  dockId: DockId;
  pane: DockPane;
  paneIndex: number;
  title: string;
}

/** Jeden panel doku: własny pasek zakładek, [+], podział i terminal aktywnej karty. */
function PaneView({ dockId, pane, paneIndex, title }: PaneViewProps): ReactElement {
  const { addTab, activateTab, closeTab, moveTab, splitTab, detachTab } = useDocks();
  const [menuOpen, setMenuOpen] = useState(false);
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
            data-testid={first ? `${dockId}-dock-add` : undefined}
            title="Nowa zakładka w tym panelu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            +
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="dock-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  data-testid={first ? `${dockId}-menu-new-claude` : undefined}
                  onClick={() => {
                    setMenuOpen(false);
                    addTab(dockId, 'claude', { paneId: pane.id });
                  }}
                >
                  Sesja Claude
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-testid={first ? `${dockId}-menu-new-terminal` : undefined}
                  onClick={() => {
                    setMenuOpen(false);
                    addTab(dockId, 'terminal', { paneId: pane.id });
                  }}
                >
                  Terminal
                </button>
              </div>
            </>
          )}
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
