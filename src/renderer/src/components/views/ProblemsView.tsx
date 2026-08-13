import { useEffect, useState, type ReactElement } from 'react';
import type { Diagnostic } from '../../../../shared/editor/diagnostics';
import { filterDiagnostics } from '../../../../shared/editor/diagnostics-auto';
import { startDiagnostics, useDiagnostics } from '../../diagnostics-store';
import { tf, tp, useT } from '../../i18n';
import { monaco } from '../../monaco-setup';
import { useWorkspace } from '../../workspace';

/**
 * Karta „Problemy" w obszarze edytora (M95). Wcześniej wyniki `tsc`/`eslint`
 * mieszkały w wąskim pasku nad dolnym dokiem: sześć rodzajów kontrolek w pasie
 * 26 px i lista, która nie miała gdzie się rozwinąć. Teraz to zwykła karta,
 * taka sama jak Ustawienia czy Historia pracy — z miejscem na treść.
 */

/** Podkreślenia w otwartych buforach; pliki niezaładowane nie mają modelu. */
function nanieMarkery(root: string, items: readonly Diagnostic[]): void {
  const poPliku = new Map<string, Diagnostic[]>();
  for (const item of items) {
    const lista = poPliku.get(item.file) ?? [];
    lista.push(item);
    poPliku.set(item.file, lista);
  }
  for (const model of monaco.editor.getModels()) {
    const sciezka = model.uri.path;
    const wzgledna = sciezka.startsWith(`${root}/`) ? sciezka.slice(root.length + 1) : '';
    const dlaPliku = wzgledna === '' ? [] : (poPliku.get(wzgledna) ?? []);
    monaco.editor.setModelMarkers(
      model,
      'sufler-diagnostics',
      dlaPliku.map((item) => ({
        severity:
          item.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
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

export function ProblemsView(): ReactElement {
  const t = useT();
  const { root, openFileAt } = useWorkspace();
  const { result, running, finishedTick } = useDiagnostics();
  const [query, setQuery] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);

  // Podkreślenia nanosimy też na pliki otwarte PO przebiegu — model powstaje
  // dopiero przy otwarciu, więc jednorazowe malowanie by je pomijało.
  useEffect(() => {
    if (result === null) {
      return;
    }
    const items = result.items;
    nanieMarkery(root, items);
    const subskrypcja = monaco.editor.onDidCreateModel(() => nanieMarkery(root, items));
    return () => subskrypcja.dispose();
  }, [result, root, finishedTick]);

  const widoczne =
    result === null ? [] : filterDiagnostics(result.items, query, onlyErrors ? 'error' : 'all');

  return (
    <div className="problems-view" data-testid="problems-view">
      <header className="problems-head">
        <div className="problems-title-row">
          <h2 className="problems-title">{t('diagnostics.problems')}</h2>
          <button
            type="button"
            className={`btn-primary problems-run${running ? ' running' : ''}`}
            data-testid="problems-run"
            disabled={running}
            onClick={() => startDiagnostics(root)}
          >
            {running ? t('diagnostics.running') : t('diagnostics.run')}
          </button>
        </div>
        {result !== null && (
          <div className="problems-counts" data-testid="problems-counts">
            <span className={`problems-count${result.errors > 0 ? ' has' : ''}`}>
              {tp('unit.errors', result.errors)}
            </span>
            <span className={`problems-count warn${result.warnings > 0 ? ' has' : ''}`}>
              {tp('unit.warnings', result.warnings)}
            </span>
            {result.failed.map((awaria) => (
              <span
                key={awaria.source}
                className="problems-failed"
                data-testid="problems-failed"
                title={awaria.message}
              >
                {tf('diagnostics.toolFailed', { tool: awaria.source })}
              </span>
            ))}
          </div>
        )}
        {result !== null && result.items.length > 0 && (
          <div className="problems-filters">
            <input
              type="search"
              className="diagnostics-filter"
              data-testid="problems-filter"
              placeholder={t('diagnostics.filter')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="problems-only-errors">
              <input
                type="checkbox"
                data-testid="problems-only-errors"
                checked={onlyErrors}
                onChange={(event) => setOnlyErrors(event.target.checked)}
              />
              {t('diagnostics.onlyErrors')}
            </label>
          </div>
        )}
      </header>

      {result === null && !running && (
        <p className="problems-empty placeholder">{t('diagnostics.neverRun')}</p>
      )}
      {running && result === null && (
        <p className="problems-empty placeholder">{t('diagnostics.running')}</p>
      )}
      {result !== null && result.items.length === 0 && (
        <p className="problems-empty placeholder" data-testid="problems-clean">
          {t('diagnostics.clean')}
        </p>
      )}

      <div className="problems-list">
        {widoczne.map((item, index) => (
          <button
            key={`${item.file}:${item.line}:${item.column}:${index}`}
            type="button"
            className={`problems-item ${item.severity}`}
            data-testid="problems-item"
            onClick={() => openFileAt(`${root}/${item.file}`, item.line, item.column)}
          >
            <span className="problems-where">
              {item.file}:{item.line}
            </span>
            <span className="problems-msg">{item.message}</span>
            <span className="problems-code">{item.code || item.source}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
