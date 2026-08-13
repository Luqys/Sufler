import { useEffect, useState, type ReactElement } from 'react';
import { sessionLabel, type ClaudeSessionSummary } from '../../../../shared/claude/claude-sessions';
import {
  isSearchableQuery,
  type SessionHits,
  type TranscriptHit,
} from '../../../../shared/claude/transcript-search';
import { tf, tp, useT } from '../../i18n';
import { clockTime } from '../../relative-time';

/** Podświetlenie trafionej frazy w wycinku rozmowy. */
function Snippet({ hit }: { hit: TranscriptHit }): ReactElement {
  const before = hit.snippet.slice(0, hit.offset);
  const match = hit.snippet.slice(hit.offset, hit.offset + hit.length);
  const after = hit.snippet.slice(hit.offset + hit.length);
  return (
    <>
      {before}
      <mark className="hit-mark">{match}</mark>
      {after}
    </>
  );
}

/**
 * Trafienia w treści rozmów (M83). Filtr nad listą zawęża tytuły i gałęzie —
 * to jest druga warstwa: fraza szukana w tym, co w rozmowach faktycznie
 * padło. Wyniki liczy proces główny strumieniowo, na żądanie, po odczekaniu
 * na przerwę w pisaniu.
 */
export function TranscriptHits({
  root,
  query,
  sessions,
  onOpen,
}: {
  root: string;
  query: string;
  sessions: ClaudeSessionSummary[] | null;
  onOpen(id: string): void;
}): ReactElement | null {
  const t = useT();
  const [results, setResults] = useState<SessionHits[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isSearchableQuery(query)) {
      setResults(null);
      setSearching(false);
      return;
    }
    // Przerwa w pisaniu: bez tego każdy znak startowałby przemiał transkryptów.
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void window.api.searchTranscripts(root, query).then((found) => {
        if (!cancelled) {
          setResults(found);
          setSearching(false);
        }
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [root, query]);

  if (!isSearchableQuery(query)) {
    return null;
  }
  if (searching && results === null) {
    return <p className="placeholder">{t('sessions.searching')}</p>;
  }
  if (results === null) {
    return null;
  }

  const titleFor = (id: string): string => {
    const known = sessions?.find((session) => session.id === id);
    return known ? sessionLabel(known.title) : `${id.slice(0, 8)}…`;
  };

  return (
    <div className="transcript-hits" data-testid="transcript-hits">
      <div className="view-title hits-title">
        {t('sessions.inConversations')}{' '}
        <span className="group-count">{results.length}</span>
      </div>
      {results.length === 0 && (
        <p className="placeholder" data-testid="hits-empty">
          {t('sessions.noHits')}
        </p>
      )}
      {results.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="hit-session"
          data-testid="hit-session"
          onClick={() => onOpen(entry.id)}
        >
          <span className="hit-session-title">{titleFor(entry.id)}</span>
          {entry.hits.map((hit, index) => (
            <span key={`${hit.timestampMs}-${index}`} className="hit-line" data-testid="hit-line">
              <span className={`hit-who ${hit.role}`}>
                {t(hit.role === 'user' ? 'sessions.you' : 'sessions.claude')}
                {hit.timestampMs > 0 && (
                  <span className="hit-time">{clockTime(hit.timestampMs)}</span>
                )}
              </span>
              <span className="hit-text">
                <Snippet hit={hit} />
              </span>
            </span>
          ))}
          {entry.more > 0 && (
            <span className="hit-more">{tf('sessions.moreHits', { count: String(entry.more) })}</span>
          )}
        </button>
      ))}
      {results.length > 0 && (
        <p className="hits-note placeholder">
          {tp('unit.sessions', results.length)} — {t('sessions.hitsNote')}
        </p>
      )}
    </div>
  );
}
