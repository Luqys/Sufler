import { useEffect, useRef, type ReactElement } from 'react';
import { monaco } from '../monaco-setup';

interface MonacoEditorProps {
  path: string;
  content: string;
}

export function MonacoEditor({ path, content }: MonacoEditorProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

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
      editor.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const uri = monaco.Uri.file(path);
    let model = monaco.editor.getModel(uri);
    if (model) {
      model.setValue(content);
    } else {
      // Język wyznaczany z rozszerzenia w URI (wbudowane gramatyki Monaco).
      model = monaco.editor.createModel(content, undefined, uri);
    }
    const previous = editor.getModel();
    editor.setModel(model);
    if (previous && previous !== model) {
      previous.dispose();
    }
  }, [path, content]);

  return <div ref={hostRef} className="monaco-host" data-testid="monaco-host" />;
}
