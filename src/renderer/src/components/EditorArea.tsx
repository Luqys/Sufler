import type { ReactElement } from 'react';

export function EditorArea(): ReactElement {
  return (
    <main className="editor-area" data-testid="editor">
      <div className="editor-empty">
        <div className="editor-empty-title">VisualN3O</div>
        <p className="placeholder">Edytor Monaco pojawi się w M2, otwieranie plików w M1.</p>
      </div>
    </main>
  );
}
