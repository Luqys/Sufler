import { useEffect, useRef, type ReactElement } from 'react';
import type { RevealTarget } from '../../workspace';
import { getModel } from '../../editor/models';
import { frontmatterRange, monaco } from '../../monaco-setup';
import { createWheelNormalizer } from '../../../../shared/system/scroll';

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
    // Kółko myszy tym samym krokiem, co reszta aplikacji: Monaco przewija
    // wprost deltą zdarzenia (~100 px = ~6 linii), gładzik zostaje natywny.
    // Nasłuch w fazie przechwytywania na hoście wyprzedza obsługę Monaco.
    const wheelNormalizer = createWheelNormalizer();
    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }
      const { device, pixels } = wheelNormalizer.normalize(
        { deltaY: event.deltaY, deltaMode: event.deltaMode, timeStamp: event.timeStamp },
        { lineHeight: editor.getOption(monaco.editor.EditorOption.lineHeight), viewport: host.clientHeight },
      );
      if (device === 'trackpad') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      editor.setScrollTop(editor.getScrollTop() + pixels);
    };
    host.addEventListener('wheel', onWheel, { capture: true, passive: false });
    // Serwer „ide": zaznaczenie w edytorze trafia do cache w main i jako
    // notyfikacja selection_changed do podłączonych sesji Claude.
    let selectionTimer: number | null = null;
    const selectionSub = editor.onDidChangeCursorSelection(() => {
      if (selectionTimer !== null) {
        window.clearTimeout(selectionTimer);
      }
      selectionTimer = window.setTimeout(() => {
        selectionTimer = null;
        const path = currentPathRef.current;
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!path || path.startsWith('vn3o://') || !model || !selection) {
          return;
        }
        window.api.ideSelectionChanged({
          text: model.getValueInRange(selection),
          filePath: path,
          fileUrl: `file://${path}`,
          selection: {
            start: {
              line: selection.startLineNumber - 1,
              character: selection.startColumn - 1,
            },
            end: { line: selection.endLineNumber - 1, character: selection.endColumn - 1 },
            isEmpty: selection.isEmpty(),
          },
        });
      }, 150);
    });
    return () => {
      selectionSub.dispose();
      host.removeEventListener('wheel', onWheel, { capture: true });
      if (selectionTimer !== null) {
        window.clearTimeout(selectionTimer);
      }
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
