import { useState, type ReactElement } from 'react';
import { useWorkspace } from '../workspace';
import { FileTree } from './FileTree';

type SidebarView = 'files' | 'skills' | 'mcp';

interface RailItem {
  id: SidebarView;
  label: string;
  icon: ReactElement;
}

const ICON_FILES = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M4 1.8h5.2L13.5 6v7.2a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1V2.8a1 1 0 0 1 1-1Z" />
    <path d="M9.2 1.8V6h4.3" />
  </svg>
);

const ICON_SKILLS = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <path d="M8 1.5l1.7 4 4.3 1.7-4.3 1.7-1.7 4-1.7-4-4.3-1.7 4.3-1.7 1.7-4Z" />
  </svg>
);

const ICON_MCP = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M5.8 1.5v3.2M10.2 1.5v3.2" />
    <path d="M4.2 4.7h7.6v2.8a3.8 3.8 0 0 1-7.6 0V4.7Z" />
    <path d="M8 11.3v3.2" />
  </svg>
);

const RAIL_ITEMS: RailItem[] = [
  { id: 'files', label: 'Pliki', icon: ICON_FILES },
  { id: 'skills', label: 'Skille i agenci', icon: ICON_SKILLS },
  { id: 'mcp', label: 'Serwery MCP', icon: ICON_MCP },
];

export function Sidebar(): ReactElement {
  const { root } = useWorkspace();
  const [view, setView] = useState<SidebarView>('files');

  return (
    <aside className="sidebar" data-testid="sidebar">
      <nav className="icon-rail" aria-label="Widoki panelu bocznego">
        {RAIL_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rail-btn${view === item.id ? ' active' : ''}`}
            title={item.label}
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.icon}
          </button>
        ))}
      </nav>
      <section className="sidebar-view">
        <div className={`view-panel${view === 'files' ? '' : ' hidden'}`}>
          <FileTree key={root} />
        </div>
        <div className={`view-panel pad${view === 'skills' ? '' : ' hidden'}`}>
          <h2 className="view-title">Skille i agenci</h2>
          <p className="placeholder">Panel skilli i agentów pojawi się w M5.</p>
        </div>
        <div className={`view-panel pad${view === 'mcp' ? '' : ' hidden'}`}>
          <h2 className="view-title">Serwery MCP</h2>
          <p className="placeholder">Panel serwerów MCP pojawi się w M6.</p>
        </div>
      </section>
    </aside>
  );
}
