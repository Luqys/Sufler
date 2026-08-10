import { useState, type DragEvent, type ReactElement } from 'react';
import type { DockId } from '../../../shared/dock-tabs';
import { useDocks } from '../docks';
import { TerminalView } from './TerminalView';

const DND_MIME = 'application/x-visualn3o-tab';

interface DockProps {
  id: DockId;
  title: string;
}

/**
 * Wspólny komponent obu doków (prawego i dolnego) — patrz SPEC.md.
 * Zakładki `terminal` i `claude` różnią się wyłącznie komendą startową pty.
 */
export function Dock({ id, title }: DockProps): ReactElement {
  const { docks, addTab, activateTab, closeTab, moveTab } = useDocks();
  const dock = docks[id];
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropHover, setDropHover] = useState(false);

  const activeTab = dock.tabs.find((tab) => tab.id === dock.activeId) ?? null;

  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes(DND_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropHover(true);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const tabId = event.dataTransfer.getData(DND_MIME);
    if (tabId) {
      event.preventDefault();
      moveTab(tabId, id);
    }
    setDropHover(false);
  };

  return (
    <section
      className={`dock dock-${id}${dropHover ? ' drop-target' : ''}`}
      data-testid={`${id}-dock`}
      onDragOver={onDragOver}
      onDragLeave={() => setDropHover(false)}
      onDrop={onDrop}
    >
      <header className="dock-header">
        <div className="dock-tabs">
          {dock.tabs.length === 0 && <span className="dock-title">{title}</span>}
          {dock.tabs.map((tab) => (
            <div
              key={tab.id}
              className={`dock-tab${tab.id === dock.activeId ? ' active' : ''}${
                tab.status === 'exited' ? ' exited' : ''
              }`}
              draggable
              title={`${tab.title} — ${tab.cwd}`}
              onClick={() => activateTab(id, tab.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData(DND_MIME, tab.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
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
          <button
            type="button"
            className="dock-add"
            data-testid={`${id}-dock-add`}
            title="Nowa zakładka"
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
                  data-testid={`${id}-menu-new-terminal`}
                  onClick={() => {
                    setMenuOpen(false);
                    addTab(id, 'terminal');
                  }}
                >
                  Terminal
                </button>
                <button type="button" role="menuitem" disabled title="Dostępne od M4">
                  Sesja Claude
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
    </section>
  );
}
