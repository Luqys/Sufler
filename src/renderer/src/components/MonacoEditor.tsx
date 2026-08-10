import { useEffect, useRef, type ReactElement } from 'react';
import type { RevealTarget } from '../workspace';
import { getModel } from '../editor/models';
import { frontmatterRange, monaco } from '../monaco-setup';

/** Pozycje kursora/scrolla per plik — przetrwają przełączanie zakładek. */
const viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>();

/** Frontmatter zwijamy tylko przy pierwszym otwarciu pliku w tej sesji. */
const frontmatterFolded = new Set<string>();

interface MonacoEditorProps {
  path: string;
  reveal?: RevealTarget;
}

export function MonacoEditor({ path, reveal }: MonacoEditorProps): ReactElement {
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

    // Zwinięcie frontmattera YAML przy pierwszym otwarciu notatki markdown.
    const model = editor.getModel();
    if (model && !frontmatterFolded.has(path) && frontmatterRange(model)) {
      frontmatterFolded.add(path);
      const timer = window.setTimeout(() => {
        if (editorRef.current === editor && currentPathRef.current === path) {
          editor.setPosition({ lineNumber: 1, column: 1 });
          void editor.getAction('editor.fold')?.run();
        }
      }, 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [path]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !reveal) {
      return;
    }
    const position = { lineNumber: reveal.line, column: reveal.column };
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
  }, [reveal]);

  return <div ref={hostRef} className="monaco-host" data-testid="monaco-host" />;
}
