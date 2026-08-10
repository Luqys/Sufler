import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { KnowledgeFile } from '../../../shared/ipc';
import { formatTokens } from '../../../shared/usage';
import { useDocks } from '../docks';
import { onKnowledgeChanged } from '../knowledge-events';
import { useDialogs } from '../ui-dialogs';
import { useWorkspace } from '../workspace';
import { fileIconFor } from './file-icons';

const ICON_REFRESH = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
    <path d="M13.6 1.8v2.8h-2.8" />
  </svg>
);

const ICON_SELECT_ALL = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="9" height="9" rx="2" />
    <path d="M4.6 6.6l1.7 1.7 2.7-3" />
    <path d="M13.9 5.5v6.4a2 2 0 0 1-2 2H5.5" />
  </svg>
);

function splitPath(path: string): { dir: string; name: string } {
  const slash = path.lastIndexOf('/');
  return slash === -1
    ? { dir: '', name: path }
    : { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) };
}

/**
 * „Wiedza": wszystkie pliki markdown projektu w jednym miejscu + generator
 * wspólnego kontekstu dla agenta (kontekst-agenta.md).
 */
const ICON_GRAPH = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="4" cy="4" r="2" />
    <circle cx="12" cy="5.5" r="2" />
    <circle cx="7" cy="12" r="2" />
    <path d="M5.8 4.6l4.3 0.6M5 10.4L4.5 6M8.6 10.8l2.4-3.6" />
  </svg>
);

export function KnowledgePanel(): ReactElement {
  const { root, openFile, openKnowledgeGraph } = useWorkspace();
  const { insertToActiveClaude } = useDocks();
  const { notify } = useDialogs();
  const [files, setFiles] = useState<KnowledgeFile[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ files: number } | null>(null);

  const refresh = useCallback(() => {
    void window.api.listKnowledge(root).then((list) => {
      setFiles(list);
      setSelected(new Set(list.map((file) => file.path)));
    });
  }, [root]);

  useEffect(() => {
    refresh();
    // Obserwator .md w main: zdarzenia zmian + automatyczny konspekt wiedzy.
    void window.api.watchKnowledge(root);
    return onKnowledgeChanged(refresh);
  }, [refresh, root]);

  const toggle = (path: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleAll = (): void => {
    setSelected((prev) =>
      prev.size === (files?.length ?? 0)
        ? new Set()
        : new Set((files ?? []).map((file) => file.path)),
    );
  };

  const generate = (): void => {
    setBusy(true);
    void window.api.generateKnowledge(root, [...selected]).then((result) => {
      setBusy(false);
      if (!result.ok) {
        notify(`Nie udało się wygenerować kontekstu: ${result.error}`, 'error');
        return;
      }
      setLastGenerated({ files: result.files });
      openFile(result.path, { pinned: true });
    });
  };

  const insertReference = (): void => {
    if (!insertToActiveClaude('@kontekst-agenta.md ')) {
      notify('Brak działającej sesji Claude — otwórz ją przyciskiem ✳ w doku.', 'error');
    }
  };

  const [mcpStatus, setMcpStatus] = useState<{
    running: boolean;
    url: string;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    void window.api.getWiedzaMcpStatus().then(setMcpStatus);
  }, []);

  const registerMcp = (): void => {
    void window.api.registerWiedzaMcp().then((result) => {
      notify(result.message, result.ok ? 'success' : 'error');
    });
  };

  const total = files?.length ?? 0;
  const selectedChars = useMemo(
    () =>
      (files ?? []).reduce(
        (sum, file) => (selected.has(file.path) ? sum + file.chars : sum),
        0,
      ),
    [files, selected],
  );
  // Zgrubny szacunek: ~4 znaki na token.
  const tokenEstimate = Math.round(selectedChars / 4);

  return (
    <div className="knowledge-panel" data-testid="knowledge-panel">
      <p className="knowledge-hint placeholder">
        Zaznacz pliki markdown i sklej je w jeden kontekst wiedzy dla agenta.
        Konspekt wiedzy (`konspekt-wiedzy.md`) aktualizuje się sam przy każdej
        zmianie notatek, a Claude pobiera go narzędziem MCP `konspekt` — zawsze
        wie, co gdzie jest.
      </p>
      <div className="knowledge-toolbar">
        <span className="knowledge-summary" data-testid="knowledge-summary">
          Zaznaczone: <strong>{selected.size}</strong> z {total}
          {selectedChars > 0 && <> · ≈ {formatTokens(tokenEstimate)} tokenów</>}
        </span>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="knowledge-graph-open"
          title="Graf wiedzy: notatki, linki i autorzy (à la Obsidian)"
          onClick={openKnowledgeGraph}
        >
          {ICON_GRAPH}
        </button>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="knowledge-toggle-all"
          title="Zaznacz wszystkie / żaden"
          onClick={toggleAll}
        >
          {ICON_SELECT_ALL}
        </button>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="knowledge-refresh"
          title="Odśwież listę"
          onClick={refresh}
        >
          {ICON_REFRESH}
        </button>
      </div>
      {files === null && <p className="placeholder">Skanuję pliki .md…</p>}
      {files !== null && files.length === 0 && (
        <div className="knowledge-empty">
          <p className="placeholder">
            Brak plików markdown w projekcie. Notatki, README i dokumentacja `.md`
            pojawią się tutaj automatycznie.
          </p>
        </div>
      )}
      <div className="knowledge-list">
        {(files ?? []).map((file) => {
          const { dir, name } = splitPath(file.path);
          return (
            <label key={file.path} className="knowledge-row" data-testid="knowledge-file">
              <input
                type="checkbox"
                checked={selected.has(file.path)}
                onChange={() => toggle(file.path)}
              />
              <span className="knowledge-file-icon">{fileIconFor(name)}</span>
              <button
                type="button"
                className="knowledge-open"
                title={`Otwórz ${file.path}`}
                onClick={(event) => {
                  event.preventDefault();
                  openFile(`${root}/${file.path}`);
                }}
              >
                {dir && <span className="knowledge-dir">{dir}</span>}
                <span className="knowledge-name">{name}</span>
              </button>
              <span className="knowledge-lines" title={`${file.lines} linii`}>
                {file.lines} lin.
              </span>
            </label>
          );
        })}
      </div>
      <div className="knowledge-actions">
        <button
          type="button"
          className="welcome-open knowledge-generate"
          data-testid="knowledge-generate"
          disabled={busy || selected.size === 0}
          onClick={generate}
        >
          {busy ? 'Generuję…' : `Generuj kontekst (${selected.size})`}
        </button>
        <div className="knowledge-mcp" data-testid="knowledge-mcp">
          <span className="knowledge-mcp-status">
            <span className={`mcp-dot ${mcpStatus?.running ? 'connected' : 'error'}`} />
            MCP grafu wiedzy{' '}
            {mcpStatus?.running ? 'działa' : (mcpStatus?.error ?? 'uruchamianie…')}
          </span>
          <button
            type="button"
            className="bar-btn"
            data-testid="wiedza-mcp-register"
            title={`claude mcp add --transport http wiedza-graf ${mcpStatus?.url ?? ''} -s user`}
            onClick={registerMcp}
          >
            Podłącz do Claude
          </button>
        </div>
        <p className="knowledge-note placeholder">
          Po podłączeniu sesje Claude mają narzędzia: graf_wiedzy · notatka · powiazania —
          agent sam sprawdza, co jest z czym powiązane.
        </p>
        {lastGenerated && (
          <div className="knowledge-result" data-testid="knowledge-note">
            <span className="knowledge-result-text">
              <span className="knowledge-result-check">✓</span> kontekst-agenta.md ·{' '}
              {lastGenerated.files} plików
            </span>
            <button
              type="button"
              className="bar-btn"
              data-testid="knowledge-insert"
              title="Wstaw @kontekst-agenta.md do aktywnej sesji Claude"
              onClick={insertReference}
            >
              @ do Claude
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
