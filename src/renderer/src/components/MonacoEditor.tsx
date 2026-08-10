import { useEffect, useRef, type ReactElement } from 'react';
import { getModel } from '../editor/models';
import { monaco } from '../monaco-setup';

/** Pozycje kursora/scrolla per plik — przetrwają przełączanie zakładek. */
const viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>();

export function MonacoEditor({ path }: { path: string }): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const currentPathRef = useRef<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const editor = monaco.editor.create(host, {
      model: null,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 12,
      padding: { top: 8 },
    });
    editorRef.current = editor;
    return () => {
      if (currentPathRef.current) {
        viewStates.set(currentPathRef.current, editor.saveViewState());
      }
      editor.dispose();
      editorRef.current = null;
      currentPathRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    if (currentPathRef.current && currentPathRef.current !== path) {
      viewStates.set(currentPathRef.current, editor.saveViewState());
    }
    editor.setModel(getModel(path));
    currentPathRef.current = path;
    const state = viewStates.get(path);
    if (state) {
      editor.restoreViewState(state);
    }
    editor.focus();
  }, [path]);

  return <div ref={hostRef} className="monaco-host" data-testid="monaco-host" />;
}
