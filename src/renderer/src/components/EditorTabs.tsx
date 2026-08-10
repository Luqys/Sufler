import type { ReactElement } from 'react';
import { useWorkspace } from '../workspace';

const ICON_GLOBE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="8" cy="8" r="6.2" />
    <ellipse cx="8" cy="8" rx="2.8" ry="6.2" />
    <path d="M1.8 8h12.4M2.7 4.9h10.6M2.7 11.1h10.6" />
  </svg>
);

export function EditorTabs(): ReactElement {
  const { tabsState, dirtyPaths, activateTab, pinTab, closeTab, openBrowserPreview } =
    useWorkspace();

  return (
    <div className="editor-tabs" data-testid="editor-tabs">
      {tabsState.tabs.map((tab) => {
        const active = tab.path === tabsState.activePath;
        const dirty = dirtyPaths.has(tab.path);
        return (
          <div
            key={tab.path}
            className={`tab${active ? ' active' : ''}${tab.pinned ? '' : ' preview'}`}
            data-testid={active ? 'tab-active' : 'tab'}
            title={tab.path}
            onClick={() => activateTab(tab.path)}
            onDoubleClick={() => pinTab(tab.path)}
          >
            {dirty && <span className="tab-dirty" data-testid="tab-dirty" />}
            <span className="tab-title">{tab.title}</span>
            <button
              type="button"
              className="tab-close"
              title="Zamknij zakładkę"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <div className="editor-tabs-actions">
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="open-preview"
          title="Podgląd przeglądarki (localhost) z trybem wskazywania elementów"
          onClick={openBrowserPreview}
        >
          {ICON_GLOBE}
        </button>
      </div>
    </div>
  );
}
