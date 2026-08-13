import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  sessionLabel,
  type ClaudeSessionDetails,
  type ClaudeSessionSummary,
} from '../../../shared/claude-sessions';
import { tf, tp, useT } from '../i18n';
import { clockTime, compactDateTime, fullDateTime, relativeTime } from '../relative-time';
import { useDocks } from '../docks';
import { useWorkspace } from '../workspace';
import { UsageHistory } from './UsageHistory';

/** Ile sesji trzyma lista — panel jest przeglądarką historii, nie menu. */
const LIST_LIMIT = 60;

const ICON_REFRESH = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
    <path d="M13.6 1.8v2.8h-2.8" />
  </svg>
);

const ICON_RESUME = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8" />
    <path d="M2.4 1.8v2.8h2.8" />
  </svg>
);

const ICON_BRANCH = (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="4.5" cy="3.5" r="1.9" />
    <circle cx="4.5" cy="12.5" r="1.9" />
    <circle cx="11.5" cy="5.5" r="1.9" />
    <path d="M4.5 5.4v5.2M11.5 7.4a5 5 0 0 1-5 3.2" />
  </svg>
);

type DetailsState = ClaudeSessionDetails | 'loading' | 'failed';

/** Rozwinięty wiersz: liczniki sesji i podgląd ostatnich wymian. */
function SessionDetails({ details }: { details: DetailsState }): ReactElement {
  const t = useT();
  if (details === 'loading') {
    return <div className="tree-note">{t('sessions.detailsLoading')}</div>;
  }
  if (details === 'failed') {
    return <div className="tree-note">{t('sessions.detailsFailed')}</div>;
  }
  return (
    <div className="session-details">
      <div className="session-counts">
        <span className="badge">{tp('unit.prompts', details.userMessages)}</span>
        <span className="badge">{tp('unit.replies', details.assistantMessages)}</span>
        {details.toolCalls > 0 && (
          <span className="badge">{tp('unit.tools', details.toolCalls)}</span>
        )}
      </div>
      {details.startedMs > 0 && (
        <div className="session-detail-date">
          {tf('sessions.started', { when: compactDateTime(details.startedMs) })}
        </div>
      )}
      {details.endedMs > 0 && (
        <div className="session-detail-date">
          {tf('sessions.lastActivity', { when: compactDateTime(details.endedMs) })}
        </div>
      )}
      <div className="session-preview-title">{t('sessions.previewTitle')}</div>
      {details.truncated && <div className="tree-note">{t('sessions.previewTruncated')}</div>}
      {details.messages.length === 0 && (
        <div className="tree-note">{t('sessions.previewEmpty')}</div>
      )}
      {details.messages.map((message, index) => (
        <div
          key={`${message.timestampMs}-${index}`}
          className={`session-message ${message.role}`}
          data-testid="session-message"
        >
          <span className="session-message-who">
            {t(message.role === 'user' ? 'sessions.you' : 'sessions.claude')}
            {message.timestampMs > 0 && (
              <span className="session-message-time">{clockTime(message.timestampMs)}</span>
            )}
          </span>
          <span className="session-message-text">{message.text}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Panel „Sesje" (M67): zapisane rozmowy z Claude dla tego projektu.
 * Dane pochodzą z transkryptów CLI (~/.claude/projects/<slug>/*.jsonl),
 * a przycisk ↺ wznawia wybraną rozmowę przez `claude --resume <id>`.
 */
export function SessionsPanel(): ReactElement {
  const t = useT();
  const { root } = useWorkspace();
  const { addTab } = useDocks();
  const [sessions, setSessions] = useState<ClaudeSessionSummary[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [details, setDetails] = useState<ReadonlyMap<string, DetailsState>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setSessions(null);
    void window.api.listClaudeSessions(root, LIST_LIMIT).then((list) => {
      if (!cancelled) {
        setSessions(list);
        setExpanded(new Set());
        setDetails(new Map());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [root, reloads]);

  const toggle = useCallback(
    (session: ClaudeSessionSummary) => {
      const opening = !expanded.has(session.id);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (opening) {
          next.add(session.id);
        } else {
          next.delete(session.id);
        }
        return next;
      });
      // Transkrypt czytamy dopiero przy rozwinięciu — bywa wielomegabajtowy.
      if (!opening || details.has(session.id)) {
        return;
      }
      setDetails((prev) => new Map(prev).set(session.id, 'loading'));
      void window.api.getClaudeSessionDetails(root, session.id).then((result) => {
        setDetails((prev) => new Map(prev).set(session.id, result ?? 'failed'));
      });
    },
    [details, expanded, root],
  );

  const resume = useCallback(
    (session: ClaudeSessionSummary) => {
      addTab('bottom', 'claude', {
        args: ['--resume', session.id],
        title: t('dock.resumeTabTitle'),
      });
    },
    [addTab, t],
  );

  return (
    <div className="sessions-panel" data-testid="sessions-panel">
      <div className="sessions-toolbar">
        <span className="mcp-note">{tp('unit.sessions', sessions?.length ?? 0)}</span>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="sessions-refresh"
          title={t('sessions.refresh')}
          onClick={() => setReloads((n) => n + 1)}
        >
          {ICON_REFRESH}
        </button>
      </div>
      <UsageHistory root={root} reloadKey={reloads} />
      {sessions === null && <p className="placeholder">{t('sessions.loading')}</p>}
      {sessions !== null && sessions.length === 0 && (
        <p className="placeholder">{t('sessions.empty')}</p>
      )}
      <div className="sessions-list">
        {(sessions ?? []).map((session) => {
          const open = expanded.has(session.id);
          return (
            <div
              key={session.id}
              className={`session-item${open ? ' open' : ''}`}
              data-testid="session-item"
            >
              <div className="session-head">
                <button
                  type="button"
                  className="session-row"
                  data-testid="session-row"
                  aria-expanded={open}
                  onClick={() => toggle(session)}
                >
                  <span className="session-main">
                    <span className="session-title" title={session.title}>
                      {sessionLabel(session.title)}
                    </span>
                    <span className="session-meta">
                      <span className="session-when" title={fullDateTime(session.mtimeMs)}>
                        {relativeTime(session.mtimeMs)}
                      </span>
                      {session.branch !== '' && (
                        <span
                          className="session-branch"
                          title={tf('sessions.branch', { branch: session.branch })}
                        >
                          {ICON_BRANCH}
                          {session.branch}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={`mcp-chevron${open ? ' open' : ''}`}>▸</span>
                </button>
                <button
                  type="button"
                  className="session-resume"
                  data-testid="session-resume"
                  title={t('sessions.resume')}
                  onClick={() => resume(session)}
                >
                  {ICON_RESUME}
                </button>
              </div>
              {open && <SessionDetails details={details.get(session.id) ?? 'loading'} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
