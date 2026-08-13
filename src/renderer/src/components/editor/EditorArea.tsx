import type { ReactElement } from 'react';
import { useT } from '../../i18n';
import type { EditorGroup } from '../../../../shared/editor/editor-groups';
import { isDiffPath } from '../../../../shared/editor/diff-tabs';
import { isImagePath } from '../../../../shared/editor/media';
import {
  HELP_PATH,
  isBrowserPreviewPath,
  KNOWLEDGE_GRAPH_PATH,
  PROBLEMS_PATH,
  SETTINGS_PATH,
  WORKLOG_PATH,
} from '../../../../shared/editor/preview';
import { useWorkspace } from '../../workspace';
import { BrowserPreview } from './BrowserPreview';
import { DiffView } from './DiffView';
import { EditorTabs } from './EditorTabs';
import { GraphView } from '../graph/GraphView';
import { HelpView } from '../views/HelpView';
import { SettingsView } from '../views/SettingsView';
import { ProblemsView } from '../views/ProblemsView';
import { WorklogView } from '../views/WorklogView';
import { ImageViewer } from './ImageViewer';
import { MonacoEditor } from './MonacoEditor';

/** Zawartość grupy pod paskiem zakładek — zależna od aktywnej zakładki grupy. */
function GroupContent({ group, focused }: { group: EditorGroup; focused: boolean }): ReactElement {
  const { buffers, revealTarget, reloadActiveFromDisk, keepMyVersion, closeTab } = useWorkspace();
  const t = useT();
  const activePath = group.activePath;

  if (!activePath) {
    return (
      <div className="editor-empty-wrap">
        <div className="editor-empty">
          <div className="editor-empty-title">Sufler</div>
          <p className="placeholder">{t('editor.empty')}</p>
        </div>
      </div>
    );
  }

  if (isBrowserPreviewPath(activePath)) {
    // Klucz = ścieżka: każdy podgląd ma własny webview i własny adres.
    return <BrowserPreview key={activePath} path={activePath} />;
  }

  if (activePath === KNOWLEDGE_GRAPH_PATH) {
    return <GraphView />;
  }

  if (activePath === SETTINGS_PATH) {
    return <SettingsView />;
  }

  if (activePath === HELP_PATH) {
    return <HelpView />;
  }

  if (activePath === WORKLOG_PATH) {
    return <WorklogView />;
  }

  if (activePath === PROBLEMS_PATH) {
    return <ProblemsView />;
  }

  if (isDiffPath(activePath)) {
    return <DiffView path={activePath} />;
  }

  if (isImagePath(activePath)) {
    return <ImageViewer path={activePath} />;
  }

  const buffer = buffers.get(activePath);
  const external = buffer?.external ?? null;

  return (
    <>
      {external !== null && (
        <div className="external-bar" data-testid="external-bar">
          <span className="external-msg">
            {external === 'changed' ? t('editor.externalChanged') : t('editor.externalDeleted')}
          </span>
          {external === 'changed' && (
            <button
              type="button"
              className="bar-btn"
              data-testid="external-reload"
              onClick={reloadActiveFromDisk}
            >
              {t('editor.reload')}
            </button>
          )}
          <button
            type="button"
            className="bar-btn"
            data-testid="external-keep"
            onClick={keepMyVersion}
          >
            {t('editor.keepMine')}
          </button>
          {external === 'deleted' && (
            <button
              type="button"
              className="bar-btn"
              onClick={() => closeTab(group.id, activePath)}
            >
              {t('common.closeTab')}
            </button>
          )}
        </div>
      )}
      {buffer?.loadError ? (
        <div className="editor-empty-wrap">
          <p className="placeholder">{buffer.loadError}</p>
        </div>
      ) : (
        <MonacoEditor
          path={activePath}
          reveal={
            focused && revealTarget?.path === activePath ? revealTarget : undefined
          }
        />
      )}
    </>
  );
}

/**
 * Przestrzeń robocza edytora (M31): kolumny grup, każda z własnym paskiem
 * zakładek i przyciskiem podziału — dzielić można bez ograniczeń.
 */
export function EditorArea(): ReactElement {
  const { groups, focusGroup } = useWorkspace();
  const multi = groups.groups.length > 1;

  return (
    <main className="editor-area" data-testid="editor">
      <div className={`editor-groups${multi ? ' multi' : ''}`}>
        {groups.groups.map((group, index) => {
          const focused = group.id === groups.activeGroupId;
          return (
            <section
              key={group.id}
              className={`editor-group${focused ? ' focused' : ''}`}
              data-testid={`editor-group-${index}`}
              onMouseDownCapture={() => focusGroup(group.id)}
            >
              <EditorTabs group={group} />
              <GroupContent group={group} focused={focused} />
            </section>
          );
        })}
      </div>
    </main>
  );
}
