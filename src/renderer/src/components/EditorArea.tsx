import type { ReactElement } from 'react';
import { CHAT_PATH } from '../../../shared/chat';
import { isImagePath } from '../../../shared/media';
import { BROWSER_PREVIEW_PATH, KNOWLEDGE_GRAPH_PATH } from '../../../shared/preview';
import { useWorkspace } from '../workspace';
import { BrowserPreview } from './BrowserPreview';
import { ChatView } from './ChatView';
import { EditorTabs } from './EditorTabs';
import { GraphView } from './GraphView';
import { ImageViewer } from './ImageViewer';
import { MonacoEditor } from './MonacoEditor';

export function EditorArea(): ReactElement {
  const { tabsState, buffers, revealTarget, reloadActiveFromDisk, keepMyVersion, closeTab } =
    useWorkspace();
  const activePath = tabsState.activePath;

  if (!activePath) {
    return (
      <main className="editor-area" data-testid="editor">
        <EditorTabs />
        <div className="editor-empty-wrap">
          <div className="editor-empty">
            <div className="editor-empty-title">VisualN3O</div>
            <p className="placeholder">Kliknij plik w panelu po lewej, aby go otworzyć.</p>
          </div>
        </div>
      </main>
    );
  }

  if (activePath === BROWSER_PREVIEW_PATH) {
    return (
      <main className="editor-area" data-testid="editor">
        <EditorTabs />
        <BrowserPreview />
      </main>
    );
  }

  if (activePath === KNOWLEDGE_GRAPH_PATH) {
    return (
      <main className="editor-area" data-testid="editor">
        <EditorTabs />
        <GraphView />
      </main>
    );
  }

  if (activePath === CHAT_PATH) {
    return (
      <main className="editor-area" data-testid="editor">
        <EditorTabs />
        <ChatView />
      </main>
    );
  }

  if (isImagePath(activePath)) {
    return (
      <main className="editor-area" data-testid="editor">
        <EditorTabs />
        <ImageViewer path={activePath} />
      </main>
    );
  }

  const buffer = buffers.get(activePath);
  const external = buffer?.external ?? null;

  return (
    <main className="editor-area" data-testid="editor">
      <EditorTabs />
      {external !== null && (
        <div className="external-bar" data-testid="external-bar">
          <span className="external-msg">
            {external === 'changed'
              ? 'Plik został zmieniony na dysku poza edytorem.'
              : 'Plik został usunięty z dysku.'}
          </span>
          {external === 'changed' && (
            <button
              type="button"
              className="bar-btn"
              data-testid="external-reload"
              onClick={reloadActiveFromDisk}
            >
              Przeładuj
            </button>
          )}
          <button
            type="button"
            className="bar-btn"
            data-testid="external-keep"
            onClick={keepMyVersion}
          >
            Zachowaj moją wersję
          </button>
          {external === 'deleted' && (
            <button type="button" className="bar-btn" onClick={() => closeTab(activePath)}>
              Zamknij zakładkę
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
          reveal={revealTarget?.path === activePath ? revealTarget : undefined}
        />
      )}
    </main>
  );
}
