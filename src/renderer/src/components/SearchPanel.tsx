import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { SearchMatch, SearchResult } from '../../../shared/ipc';
import { tf, tp, useT } from '../i18n';
import { useWorkspace } from '../workspace';

export function SearchPanel(): ReactElement {
  const t = useT();
  const { root, openFileAt } = useWorkspace();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResult(null);
      setSearching(false);
      return;
    }
    const mySequence = ++sequence.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void window.api.searchProject(root, trimmed).then((response) => {
        if (sequence.current === mySequence) {
          setResult(response);
          setSearching(false);
        }
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, root]);

  const grouped = useMemo(() => {
    if (!result?.ok) {
      return new Map<string, SearchMatch[]>();
    }
    const groups = new Map<string, SearchMatch[]>();
    for (const match of result.matches) {
      const list = groups.get(match.path) ?? [];
      list.push(match);
      groups.set(match.path, list);
    }
    return groups;
  }, [result]);

  const totalMatches = result?.ok ? result.matches.length : 0;

  return (
    <div className="search-panel" data-testid="search-panel">
      <input
        type="search"
        className="search-input"
        data-testid="search-input"
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        spellCheck={false}
      />
      <div className="search-status placeholder">
        {searching && t('search.searching')}
        {!searching && result?.ok && query.trim().length >= 2 && (
          <>
            {totalMatches === 0
              ? t('search.noMatches')
              : `${tp('unit.matches', totalMatches)} ${tf('search.inFiles', { m: grouped.size })}`}
            {result.truncated && t('search.truncated')}
          </>
        )}
        {!searching && result && !result.ok && <span className="search-error">{result.error}</span>}
      </div>
      <div className="search-results">
        {[...grouped.entries()].map(([path, matches]) => (
          <div key={path} className="search-group">
            <button
              type="button"
              className="search-file"
              title={path}
              onClick={() => openFileAt(`${root}/${path}`, matches[0]?.line ?? 1, 1)}
            >
              {path}
            </button>
            {matches.map((match) => (
              <button
                key={`${match.line}:${match.column}`}
                type="button"
                className="search-match"
                data-testid="search-match"
                title={`${path}:${match.line}`}
                onClick={() => openFileAt(`${root}/${match.path}`, match.line, match.column)}
              >
                <span className="search-line">{match.line}</span>
                <span className="search-preview">{match.preview}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
