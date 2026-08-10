import type { ReactElement } from 'react';
import { useWorkspace } from '../workspace';
import { MonacoEditor } from './MonacoEditor';

export function EditorArea(): ReactElement {
  const { root, currentFile } = useWorkspace();

  if (!currentFile) {
    return (
      <main className="editor-area" data-testid="editor">
        <div className="editor-empty-wrap">
          <div className="editor-empty">
            <div className="editor-empty-title">VisualN3O</div>
            <p className="placeholder">Kliknij plik w panelu po lewej, aby go otworzyć.</p>
          </div>
        </div>
      </main>
    );
  }

  const relativePath = currentFile.path.startsWith(`${root}/`)
    ? currentFile.path.slice(root.length + 1)
    : currentFile.path;

  return (
    <main className="editor-area" data-testid="editor">
      <div className="editor-file-bar" data-testid="current-file" title={currentFile.path}>
        {relativePath}
      </div>
      {currentFile.status === 'loaded' ? (
        <MonacoEditor path={currentFile.path} content={currentFile.content} />
      ) : (
        <div className="editor-empty-wrap">
          <p className="placeholder">{currentFile.message}</p>
        </div>
      )}
    </main>
  );
}
