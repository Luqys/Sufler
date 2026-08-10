import type { ReactElement } from 'react';
import { useWorkspace } from '../workspace';

export function EditorTabs(): ReactElement {
  const { tabsState, dirtyPaths, activateTab, pinTab, closeTab } = useWorkspace();

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
    </div>
  );
}
