import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import cssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

// Spec: tylko podświetlanie składni, bez LSP. Semantyczna walidacja TS/JS pokazywałaby
// fałszywe błędy (nierozwiązywalne importy), więc zostaje wyłącznie walidacja składni.
const diagnosticsOptions = {
  noSemanticValidation: true,
  noSyntaxValidation: false,
  noSuggestionDiagnostics: true,
};
monaco.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
monaco.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);

// Motyw matrixowy edytora: kolory składni z vs-dark, tło i tekst w zieleniach.
monaco.editor.defineTheme('sufler-matrix', {
  base: 'vs-dark',
  inherit: true,
  rules: [{ token: '', foreground: 'c6ffd0', background: '050b06' }],
  colors: {
    'editor.background': '#050b06',
    'editor.foreground': '#c6ffd0',
    'editorLineNumber.foreground': '#2f7a44',
    'editorLineNumber.activeForeground': '#5cff8f',
    'editorCursor.foreground': '#00e653',
    'editor.selectionBackground': '#134d26',
    'editor.lineHighlightBackground': '#0a1a0f',
    'editorWidget.background': '#081209',
    'editorGutter.background': '#050b06',
  },
});

const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(): void {
  const matrix = document.documentElement.dataset['flavor'] === 'matrix';
  monaco.editor.setTheme(matrix ? 'sufler-matrix' : darkMedia.matches ? 'vs-dark' : 'vs');
}
darkMedia.addEventListener('change', applyTheme);
// Zmiana smaku motywu (Matrix ↔ zwykły) — patrz appearance-client.
window.addEventListener('sufler:flavor', applyTheme);
applyTheme();

// Frontmatter YAML notatek markdown jako zwijalny region (SPEC.md, Obsidian w. 1).
monaco.languages.registerFoldingRangeProvider('markdown', {
  provideFoldingRanges(model) {
    if (model.getLineCount() < 3 || model.getLineContent(1).trim() !== '---') {
      return [];
    }
    const limit = Math.min(model.getLineCount(), 80);
    for (let line = 2; line <= limit; line++) {
      if (model.getLineContent(line).trim() === '---') {
        return [{ start: 1, end: line, kind: monaco.languages.FoldingRangeKind.Region }];
      }
    }
    return [];
  },
});

/** Zakres frontmattera (1..n) albo null — do automatycznego zwinięcia przy otwarciu. */
export function frontmatterRange(model: monaco.editor.ITextModel): { start: number; end: number } | null {
  if (model.getLanguageId() !== 'markdown') {
    return null;
  }
  if (model.getLineCount() < 3 || model.getLineContent(1).trim() !== '---') {
    return null;
  }
  const limit = Math.min(model.getLineCount(), 80);
  for (let line = 2; line <= limit; line++) {
    if (model.getLineContent(line).trim() === '---') {
      return { start: 1, end: line };
    }
  }
  return null;
}

export { monaco };
