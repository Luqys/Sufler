import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { KnowledgeFile } from '../../../shared/ipc';
import { useDocks } from '../docks';
import { useWorkspace } from '../workspace';

const ICON_REFRESH = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
    <path d="M13.6 1.8v2.8h-2.8" />
  </svg>
);

function splitPath(path: string): { dir: string; name: string } {
  const slash = path.lastIndexOf('/');
  return slash === -1
    ? { dir: '', name: path }
    : { dir: path.slice(0, slash), name: path.slice(slash + 1) };
}

/**
 * „Wiedza": wszystkie pliki markdown projektu w jednym miejscu + generator
 * wspólnego kontekstu dla agenta (kontekst-agenta.md).
 */
export function KnowledgePanel(): ReactElement {
  const { root, openFile } = useWorkspace();
  const { insertToActiveClaude } = useDocks();
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
  }, [refresh]);

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
        window.alert(`Nie udało się wygenerować kontekstu: ${result.error}`);
        return;
      }
      setLastGenerated({ files: result.files });
      openFile(result.path, { pinned: true });
    });
  };

  const insertReference = (): void => {
    if (!insertToActiveClaude('@kontekst-agenta.md ')) {
      window.alert('Brak działającej sesji Claude — otwórz ją przyciskiem + w doku.');
    }
  };

  const total = files?.length ?? 0;

  return (
    <div className="knowledge-panel" data-testid="knowledge-panel">
      <div className="knowledge-toolbar">
        <span className="mcp-note">Pliki markdown projektu ({total})</span>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="knowledge-toggle-all"
          title="Zaznacz wszystkie / żaden"
          onClick={toggleAll}
        >
          ☑
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
        <p className="placeholder">Brak plików markdown w projekcie.</p>
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
              <button
                type="button"
                className="knowledge-open"
                title={`Otwórz ${file.path}`}
                onClick={(event) => {
                  event.preventDefault();
                  openFile(`${root}/${file.path}`);
                }}
              >
                <span className="skill-name">{name}</span>
                {dir && <span className="knowledge-dir">{dir}/</span>}
              </button>
              <span className="knowledge-lines">{file.lines}</span>
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
        {lastGenerated && (
          <>
            <p className="knowledge-note placeholder" data-testid="knowledge-note">
              ✓ kontekst-agenta.md · {lastGenerated.files} plików — otwarty w edytorze.
            </p>
            <button
              type="button"
              className="bar-btn"
              data-testid="knowledge-insert"
              title="Wstaw @kontekst-agenta.md do aktywnej sesji Claude"
              onClick={insertReference}
            >
              @ do Claude
            </button>
          </>
        )}
      </div>
    </div>
  );
}
