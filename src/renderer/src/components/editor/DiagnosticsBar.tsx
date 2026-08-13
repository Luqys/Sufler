import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Diagnostic, DiagnosticsResult } from '../../../../shared/editor/diagnostics';
import { autoRunDelay, filterDiagnostics } from '../../../../shared/editor/diagnostics-auto';
import { tf, tp, useT } from '../../i18n';
import { monaco } from '../../monaco-setup';
import { useWorkspace } from '../../workspace';

const ICON_PLAY = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M4.5 3.2v9.6l7.5-4.8-7.5-4.8Z" />
  </svg>
);

/**
 * Znaczniki Monaco dla otwartych buforów — podkreślenia w miejscu błędu.
 * Model żyje pod URI pliku, więc trafiamy w ten sam bufor, który widzi
 * użytkownik; pliki niezaładowane po prostu nie mają modelu.
 */
function applyMarkers(root: string, items: readonly Diagnostic[]): void {
  const byFile = new Map<string, Diagnostic[]>();
  for (const item of items) {
    const list = byFile.get(item.file) ?? [];
    list.push(item);
    byFile.set(item.file, list);
  }
  for (const model of monaco.editor.getModels()) {
    const path = model.uri.path;
    const relative = path.startsWith(`${root}/`) ? path.slice(root.length + 1) : '';
    const forFile = relative === '' ? [] : (byFile.get(relative) ?? []);
    monaco.editor.setModelMarkers(
      model,
      'sufler-diagnostics',
      forFile.map((item) => ({
        severity:
          item.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : monaco.MarkerSeverity.Warning,
        message: item.code === '' ? item.message : `${item.message} (${item.code})`,
        startLineNumber: item.line,
        startColumn: item.column,
        endLineNumber: item.line,
        endColumn: item.column + 1,
        source: item.source,
      })),
    );
  }
}

/**
 * Pasek diagnostyki pod edytorem (M71): uruchamia `tsc` i `eslint` na żądanie,
 * pokazuje liczniki, a po rozwinięciu listę, z której klik skacze do linii.
 * To jest świadomy substytut LSP — patrz docs/SPEC.md.
 */
export function DiagnosticsBar(): ReactElement {
  const t = useT();
  const { root, openFileAt, savedTick } = useWorkspace();
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  /** Tryb automatyczny i filtr listy problemów (M90). */
  const [auto, setAuto] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const lastFinishedRef = useRef(0);
  const runningRef = useRef(false);
  const rootRef = useRef(root);
  rootRef.current = root;

  // Zmiana projektu unieważnia wynik — pokazywanie cudzych błędów myli.
  useEffect(() => {
    setResult(null);
    setOpen(false);
  }, [root]);

  /*
   * Plik otwarty PO sprawdzeniu też ma dostać podkreślenia: model powstaje
   * dopiero przy otwarciu, więc jednorazowe malowanie po przebiegu pomijało
   * dokładnie te pliki, do których człowiek skacze z listy.
   */
  useEffect(() => {
    if (result === null) {
      return;
    }
    const items = result.items;
    applyMarkers(rootRef.current, items);
    const subscription = monaco.editor.onDidCreateModel(() => {
      applyMarkers(rootRef.current, items);
    });
    return () => subscription.dispose();
  }, [result]);

  useEffect(() => {
    void window.api.getDiagnosticsAuto().then(setAuto);
  }, []);

  const run = (): void => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    setRunning(true);
    const forRoot = rootRef.current;
    void window.api.runDiagnostics(forRoot).then((next) => {
      if (rootRef.current !== forRoot) {
        return;
      }
      runningRef.current = false;
      lastFinishedRef.current = Date.now();
      setRunning(false);
      setResult(next);
      setOpen(next.items.length > 0);
    });
  };

  /*
   * Zapis pliku uruchamia przebieg, ale z dławikiem: seria `Cmd+S` daje jeden
   * przebieg, a kolejny nie ruszy szybciej niż po odstępie. `tsc` na tym repo
   * trwa kilkanaście sekund — sprawdzanie po każdym zapisie byłoby gorsze niż
   * brak sprawdzania.
   */
  useEffect(() => {
    if (savedTick === 0) {
      return;
    }
    const delay = autoRunDelay(
      { lastFinishedMs: lastFinishedRef.current, running: runningRef.current },
      auto,
      Date.now(),
    );
    if (delay === null) {
      return;
    }
    const timer = window.setTimeout(() => runRef.current(), delay);
    return () => window.clearTimeout(timer);
  }, [auto, savedTick]);

  const runRef = useRef(run);
  runRef.current = run;

  const clean = result !== null && result.items.length === 0;
  const visible =
    result === null ? [] : filterDiagnostics(result.items, query, onlyErrors ? 'error' : 'all');

  return (
    <div className={`diagnostics-bar${open ? ' open' : ''}`} data-testid="diagnostics-bar">
      <div className="diagnostics-head">
        <button
          type="button"
          className="bar-btn diagnostics-run"
          data-testid="diagnostics-run"
          disabled={running}
          title={t('diagnostics.runHint')}
          onClick={run}
        >
          {ICON_PLAY}
          {running ? t('diagnostics.running') : t('diagnostics.run')}
        </button>
        {result !== null && (
          <button
            type="button"
            className="diagnostics-counts"
            data-testid="diagnostics-counts"
            aria-expanded={open}
            disabled={result.items.length === 0}
            onClick={() => setOpen((current) => !current)}
          >
            <span className={`diagnostics-count${result.errors > 0 ? ' has' : ''}`}>
              {tp('unit.errors', result.errors)}
            </span>
            <span className={`diagnostics-count warn${result.warnings > 0 ? ' has' : ''}`}>
              {tp('unit.warnings', result.warnings)}
            </span>
          </button>
        )}
        {clean && <span className="diagnostics-clean">{t('diagnostics.clean')}</span>}
        {result !== null && result.items.length > 0 && (
          <>
            <input
              type="search"
              className="diagnostics-filter"
              data-testid="diagnostics-filter"
              placeholder={t('diagnostics.filter')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="diagnostics-only-errors">
              <input
                type="checkbox"
                data-testid="diagnostics-only-errors"
                checked={onlyErrors}
                onChange={(event) => setOnlyErrors(event.target.checked)}
              />
              {t('diagnostics.onlyErrors')}
            </label>
          </>
        )}
        <label className="diagnostics-auto" title={t('diagnostics.autoHint')}>
          <input
            type="checkbox"
            data-testid="diagnostics-auto"
            checked={auto}
            onChange={(event) => {
              const next = event.target.checked;
              setAuto(next);
              void window.api.setDiagnosticsAuto(next);
            }}
          />
          {t('diagnostics.auto')}
        </label>
        {result?.failed.map((failure) => (
          <span
            key={failure.source}
            className="diagnostics-failed"
            data-testid="diagnostics-failed"
            title={failure.message}
          >
            {tf('diagnostics.toolFailed', { tool: failure.source })}
          </span>
        ))}
      </div>
      {open && result !== null && (
        <div className="diagnostics-list" data-testid="diagnostics-list">
          {visible.map((item, index) => (
            <button
              key={`${item.file}:${item.line}:${item.column}:${index}`}
              type="button"
              className={`diagnostics-item ${item.severity}`}
              data-testid="diagnostics-item"
              onClick={() => openFileAt(`${root}/${item.file}`, item.line, item.column)}
            >
              <span className="diagnostics-where">
                {item.file}:{item.line}
              </span>
              <span className="diagnostics-msg" title={item.message}>
                {item.message}
              </span>
              <span className="diagnostics-code">{item.code || item.source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
