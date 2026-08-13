import { useState, type DragEvent, type ReactElement } from 'react';
import { isDiffPath } from '../../../shared/diff-tabs';
import type { EditorGroup } from '../../../shared/editor-groups';
import { baseName } from '../../../shared/paths';
import { isBrowserPreviewPath, KNOWLEDGE_GRAPH_PATH } from '../../../shared/preview';
import { useT } from '../i18n';
import { useWorkspace } from '../workspace';
import { fileIconFor } from './file-icons';
import { isOutsideWindow } from '../../../shared/detached';

const DND_MIME = 'application/x-visualn3o-editor-tab';

const ICON_GLOBE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="8" cy="8" r="6.2" />
    <ellipse cx="8" cy="8" rx="2.8" ry="6.2" />
    <path d="M1.8 8h12.4M2.7 4.9h10.6M2.7 11.1h10.6" />
  </svg>
);

const ICON_SPLIT = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.6" />
    <path d="M8 2.6v10.8" />
  </svg>
);

const ICON_GLOBE_SMALL = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#4f8ff7" strokeWidth="1.4">
    <circle cx="8" cy="8" r="6" />
    <ellipse cx="8" cy="8" rx="2.7" ry="6" />
    <path d="M2 8h12" />
  </svg>
);

const ICON_GRAPH = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#b78af5" strokeWidth="1.4">
    <circle cx="4" cy="4.4" r="1.9" />
    <circle cx="12" cy="6.4" r="1.9" />
    <circle cx="6.6" cy="11.8" r="1.9" />
    <path d="M5.7 5.5l4.5 0.5M5.2 6l0.8 4M10.7 7.7l-2.7 2.8" />
  </svg>
);

const ICON_DIFF = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d97757" strokeWidth="1.4">
    <path d="M5 2.2v7.2M5 9.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z" />
    <path d="M11 13.8V6.6M11 6.6a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
  </svg>
);

/** Ikona zakładki: widoki specjalne mają własne „faviconki", pliki — wg typu. */
function tabIcon(path: string): ReactElement {
  if (path === KNOWLEDGE_GRAPH_PATH) {
    return ICON_GRAPH;
  }
  if (isBrowserPreviewPath(path)) {
    return ICON_GLOBE_SMALL;
  }
  if (isDiffPath(path)) {
    return ICON_DIFF;
  }
  return fileIconFor(baseName(path));
}

/** Pasek zakładek jednej grupy edytora — z przyciskiem podziału przestrzeni. */
export function EditorTabs({ group }: { group: EditorGroup }): ReactElement {
  const {
    dirtyPaths,
    activateTab,
    pinTab,
    reorderTab,
    closeTab,
    openBrowserPreview,
    splitEditorGroup,
  } = useWorkspace();
  const t = useT();
  const [dropPath, setDropPath] = useState<string | null>(null);

  const onTabDragOver = (event: DragEvent<HTMLElement>, path: string): void => {
    if (event.dataTransfer.types.includes(DND_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropPath(path);
    }
  };

  const onTabDrop = (event: DragEvent<HTMLElement>, path: string): void => {
    const fromPath = event.dataTransfer.getData(DND_MIME);
    if (fromPath) {
      event.preventDefault();
      reorderTab(group.id, fromPath, path);
    }
    setDropPath(null);
  };

  return (
    <div className="editor-tabs" data-testid="editor-tabs">
      {group.tabs.map((tab) => {
        const active = tab.path === group.activePath;
        const dirty = dirtyPaths.has(tab.path);
        return (
          <div
            key={tab.path}
            className={`tab${active ? ' active' : ''}${tab.pinned ? '' : ' preview'}${
              dropPath === tab.path ? ' drop-before' : ''
            }`}
            data-testid={active ? 'tab-active' : 'tab'}
            title={tab.path}
            draggable
            onClick={() => activateTab(group.id, tab.path)}
            onDoubleClick={() => pinTab(group.id, tab.path)}
            onDragStart={(event) => {
              event.dataTransfer.setData(DND_MIME, tab.path);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={(event) => {
              // Upuszczenie poza oknem → karta jedzie do osobnego okna.
              if (isOutsideWindow(event, window)) {
                void window.api.openDetachedWindow({
                  kind: 'view',
                  target: tab.path,
                  title: tab.title,
                });
                closeTab(group.id, tab.path);
              }
            }}
            onDragOver={(event) => onTabDragOver(event, tab.path)}
            onDragLeave={() => setDropPath((current) => (current === tab.path ? null : current))}
            onDrop={(event) => onTabDrop(event, tab.path)}
          >
            <span className="tab-icon">{tabIcon(tab.path)}</span>
            {dirty && <span className="tab-dirty" data-testid="tab-dirty" />}
            <span className="tab-title">{tab.title}</span>
            <button
              type="button"
              className="tab-close"
              title={t('common.closeTab')}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(group.id, tab.path);
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
          data-testid="editor-split"
          title={t('tabs.split')}
          onClick={() => splitEditorGroup(group.id)}
        >
          {ICON_SPLIT}
        </button>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="open-preview"
          title={t('tabs.preview')}
          onClick={openBrowserPreview}
        >
          {ICON_GLOBE}
        </button>
      </div>
    </div>
  );
}
