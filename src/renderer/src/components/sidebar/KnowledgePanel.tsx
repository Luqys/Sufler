import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { KnowledgeFile } from '../../../../shared/ipc';
import { SESSION_LOG_DIR } from '../../../../shared/claude/session-log';
import { tf, tp, useT } from '../../i18n';
import { onKnowledgeChanged, onWiedzaMcpChanged } from '../../knowledge-events';
import { useDialogs } from '../../ui-dialogs';
import { useWorkspace } from '../../workspace';
import { fileIconFor } from './file-icons';

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
    : { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) };
}

/**
 * „Wiedza": wszystkie pliki markdown projektu w jednym miejscu; Claude czyta je
 * przez konspekt wiedzy i narzędzia MCP grafu (bez ręcznego sklejania kontekstu).
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
  const t = useT();
  const { root, openFile, openKnowledgeGraph } = useWorkspace();
  const { notify } = useDialogs();
  const [files, setFiles] = useState<KnowledgeFile[] | null>(null);

  const refresh = useCallback(() => {
    void window.api.listKnowledge(root).then(setFiles);
  }, [root]);

  useEffect(() => {
    refresh();
    // Obserwator .md w main: zdarzenia zmian + automatyczny konspekt wiedzy.
    void window.api.watchKnowledge(root);
    return onKnowledgeChanged(refresh);
  }, [refresh, root]);

  const [mcpStatus, setMcpStatus] = useState<{
    running: boolean;
    url: string;
    error: string | null;
  } | null>(null);

  // Status czytamy przy montowaniu ORAZ na każdą zmianę z main: `listen()`
  // jest asynchroniczny, więc pierwszy odczyt trafiał czasem przed startem
  // serwera i sekcja zostawała na „uruchamianie" (zgłoszenie użytkowników).
  useEffect(() => {
    const readStatus = (): void => {
      void window.api.getWiedzaMcpStatus().then(setMcpStatus);
    };
    readStatus();
    return onWiedzaMcpChanged(readStatus);
  }, []);

  const [summarizing, setSummarizing] = useState<string | null>(null);

  const summarize = (path: string): void => {
    setSummarizing(path);
    void window.api.summarizeSessionLog(root, path).then((result) => {
      setSummarizing(null);
      if (result.ok) {
        notify(t('knowledge.summarizeOk'), 'success');
        refresh();
      } else {
        notify(
          t(
            result.error === 'too-short'
              ? 'knowledge.summarizeShort'
              : result.error === 'claude-failed'
                ? 'knowledge.summarizeFailed'
                : 'knowledge.summarizeError',
          ),
          'error',
        );
      }
    });
  };

  const registerMcp = (): void => {
    void window.api.registerWiedzaMcp().then((result) => {
      notify(result.message, result.ok ? 'success' : 'error');
    });
  };

  return (
    <div className="knowledge-panel" data-testid="knowledge-panel">
      <p className="knowledge-hint placeholder">{t('knowledge.hint')}</p>
      <div className="knowledge-toolbar">
        <span className="knowledge-summary" data-testid="knowledge-summary">
          {tp('unit.files', files?.length ?? 0)}
        </span>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="knowledge-graph-open"
          title={t('knowledge.graphOpen')}
          onClick={openKnowledgeGraph}
        >
          {ICON_GRAPH}
        </button>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="knowledge-refresh"
          title={t('knowledge.refresh')}
          onClick={refresh}
        >
          {ICON_REFRESH}
        </button>
      </div>
      {files === null && <p className="placeholder">{t('knowledge.scanning')}</p>}
      {files !== null && files.length === 0 && (
        <div className="knowledge-empty">
          <p className="placeholder">{t('knowledge.noFiles')}</p>
        </div>
      )}
      <div className="knowledge-list">
        {(files ?? []).map((file) => {
          const { dir, name } = splitPath(file.path);
          return (
            <div key={file.path} className="knowledge-row" data-testid="knowledge-file">
              <span className="knowledge-file-icon">{fileIconFor(name)}</span>
              <button
                type="button"
                className="knowledge-open"
                title={tf('knowledge.openFile', { path: file.path })}
                onClick={() => {
                  openFile(`${root}/${file.path}`);
                }}
              >
                {dir && <span className="knowledge-dir">{dir}</span>}
                <span className="knowledge-name">{name}</span>
              </button>
              {file.path.startsWith(`${SESSION_LOG_DIR}/`) && (
                <button
                  type="button"
                  className="knowledge-summarize"
                  data-testid="knowledge-summarize"
                  disabled={summarizing === file.path}
                  title={t('knowledge.summarizeHint')}
                  onClick={() => summarize(file.path)}
                >
                  {summarizing === file.path ? t('knowledge.summarizing') : t('knowledge.summarize')}
                </button>
              )}
              <span className="knowledge-lines" title={tp('unit.lines', file.lines)}>
                {file.lines} {t('common.linesAbbr')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="knowledge-actions">
        <div className="knowledge-mcp" data-testid="knowledge-mcp">
          <span className="knowledge-mcp-status">
            <span className={`mcp-dot ${mcpStatus?.running ? 'connected' : 'error'}`} />
            {t('knowledge.mcpLabel')}{' '}
            {mcpStatus?.running ? t('knowledge.mcpRunning') : (mcpStatus?.error ?? t('knowledge.mcpStarting'))}
          </span>
          <button
            type="button"
            className="bar-btn"
            data-testid="wiedza-mcp-register"
            title={`claude mcp add --transport http wiedza-graf ${mcpStatus?.url ?? ''} -s user`}
            onClick={registerMcp}
          >
            {t('knowledge.mcpRegister')}
          </button>
        </div>
        <p className="knowledge-note placeholder">{t('knowledge.mcpNote')}</p>
      </div>
    </div>
  );
}
