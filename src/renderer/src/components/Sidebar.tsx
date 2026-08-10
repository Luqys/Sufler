import { useState, type ReactElement } from 'react';
import type { StringKey } from '../../../shared/i18n';
import { useT } from '../i18n';
import { useWorkspace } from '../workspace';
import { FileTree } from './FileTree';
import { GitPanel } from './GitPanel';
import { KnowledgePanel } from './KnowledgePanel';
import { McpPanel } from './McpPanel';
import { SearchPanel } from './SearchPanel';
import { SkillsPanel } from './SkillsPanel';

type SidebarView = 'files' | 'search' | 'git' | 'knowledge' | 'skills' | 'mcp';

interface RailItem {
  id: SidebarView;
  labelKey: StringKey;
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

const ICON_SEARCH = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.4" />
    <path d="M10.4 10.4L14 14" />
  </svg>
);

const ICON_KNOWLEDGE = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <path d="M2.6 3.4A1.9 1.9 0 0 1 4.5 1.5h9v11.1h-9a1.9 1.9 0 0 0-1.9 1.9V3.4Z" />
    <path d="M13.5 12.6v1.9H4.4" strokeLinecap="round" />
    <path d="M5.6 4.8h5M5.6 7.2h5" strokeLinecap="round" />
  </svg>
);

const ICON_GIT = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="4.5" cy="3.5" r="2" />
    <circle cx="4.5" cy="12.5" r="2" />
    <circle cx="11.5" cy="5.5" r="2" />
    <path d="M4.5 5.5v5M11.5 7.5a5 5 0 0 1-5 3.3" />
  </svg>
);

const RAIL_ITEMS: RailItem[] = [
  { id: 'files', labelKey: 'sidebar.rail.files', icon: ICON_FILES },
  { id: 'search', labelKey: 'sidebar.rail.search', icon: ICON_SEARCH },
  { id: 'git', labelKey: 'sidebar.rail.git', icon: ICON_GIT },
  { id: 'knowledge', labelKey: 'sidebar.rail.knowledge', icon: ICON_KNOWLEDGE },
  { id: 'skills', labelKey: 'sidebar.rail.skills', icon: ICON_SKILLS },
  { id: 'mcp', labelKey: 'sidebar.rail.mcp', icon: ICON_MCP },
];

export function Sidebar(): ReactElement {
  const { root, vault, openKnowledgeGraph } = useWorkspace();
  const t = useT();
  const [view, setView] = useState<SidebarView>('files');

  const selectView = (id: SidebarView): void => {
    setView(id);
    // Wiedza od razu pokazuje graf w obszarze edytora (panel zostaje w sidebarze).
    if (id === 'knowledge') {
      openKnowledgeGraph();
    }
  };

  return (
    <aside className="sidebar" data-testid="sidebar">
      <nav className="icon-rail" aria-label={t('sidebar.aria')}>
        {RAIL_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rail-btn${view === item.id ? ' active' : ''}`}
            title={t(item.labelKey)}
            data-testid={`rail-${item.id}`}
            aria-pressed={view === item.id}
            onClick={() => selectView(item.id)}
          >
            {item.icon}
          </button>
        ))}
      </nav>
      <section className="sidebar-view">
        <div className={`view-panel${view === 'files' ? '' : ' hidden'}`}>
          <FileTree key={`${root}|${vault ?? ''}`} />
        </div>
        <div className={`view-panel pad${view === 'search' ? '' : ' hidden'}`}>
          <h2 className="view-title">{t('sidebar.view.search')}</h2>
          <SearchPanel />
        </div>
        <div className={`view-panel pad scroll${view === 'git' ? '' : ' hidden'}`}>
          <h2 className="view-title">{t('sidebar.view.git')}</h2>
          <GitPanel key={root} />
        </div>
        <div className={`view-panel pad scroll${view === 'knowledge' ? '' : ' hidden'}`}>
          <h2 className="view-title">{t('sidebar.view.knowledge')}</h2>
          <KnowledgePanel key={root} />
        </div>
        <div className={`view-panel pad scroll${view === 'skills' ? '' : ' hidden'}`}>
          <h2 className="view-title">{t('sidebar.view.skills')}</h2>
          <SkillsPanel />
        </div>
        <div className={`view-panel pad scroll${view === 'mcp' ? '' : ' hidden'}`}>
          <h2 className="view-title">{t('sidebar.view.mcp')}</h2>
          <McpPanel />
        </div>
      </section>
    </aside>
  );
}
