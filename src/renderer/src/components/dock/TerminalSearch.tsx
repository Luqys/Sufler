import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  findMatches,
  initialMatch,
  stepMatch,
  type TerminalMatch,
} from '../../../../shared/docks/terminal-search';
import { tf, useT } from '../../i18n';
import {
  clearTerminalMatch,
  getTerminalInstance,
  revealTerminalMatch,
  terminalLines,
} from '../../terminals';

/**
 * Szukajka w buforze terminala (M101). Bufor czytamy przy każdej zmianie
 * frazy, nie trzymamy kopii: sesja dopisuje wiersze bez przerwy, a kopia
 * zestarzałaby się między jednym a drugim wciśnięciem klawisza.
 */
export function TerminalSearch({
  tabId,
  onClose,
}: {
  tabId: string;
  onClose: () => void;
}): ReactElement {
  const t = useT();
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(-1);
  const [matches, setMatches] = useState<TerminalMatch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => clearTerminalMatch(tabId);
  }, [tabId]);

  const jump = useCallback(
    (list: TerminalMatch[], index: number) => {
      setCurrent(index);
      const match = list[index];
      if (match) {
        revealTerminalMatch(tabId, match);
      } else {
        clearTerminalMatch(tabId);
      }
    },
    [tabId],
  );

  const search = useCallback(
    (value: string) => {
      setQuery(value);
      const list = findMatches(terminalLines(tabId), value);
      setMatches(list);
      jump(list, initialMatch(list));
    },
    [jump, tabId],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      jump(matches, stepMatch(matches.length, current, direction));
    },
    [current, jump, matches],
  );

  const licznik = useMemo(() => {
    if (query.trim() === '') {
      return '';
    }
    return matches.length === 0
      ? t('terminal.searchNone')
      : tf('terminal.searchCount', { index: current + 1, total: matches.length });
  }, [current, matches.length, query, t]);

  const close = (): void => {
    clearTerminalMatch(tabId);
    onClose();
    getTerminalInstance(tabId)?.term.focus();
  };

  return (
    <div className="terminal-search" data-testid="terminal-search">
      <input
        ref={inputRef}
        type="text"
        className="terminal-search-input"
        data-testid="terminal-search-input"
        placeholder={t('terminal.searchPlaceholder')}
        value={query}
        spellCheck={false}
        onChange={(event) => search(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
          }
        }}
      />
      <span className="terminal-search-count" data-testid="terminal-search-count">
        {licznik}
      </span>
      <button
        type="button"
        className="bar-btn"
        data-testid="terminal-search-prev"
        title={t('terminal.searchPrev')}
        onClick={() => step(-1)}
        disabled={matches.length === 0}
      >
        ↑
      </button>
      <button
        type="button"
        className="bar-btn"
        data-testid="terminal-search-next"
        title={t('terminal.searchNext')}
        onClick={() => step(1)}
        disabled={matches.length === 0}
      >
        ↓
      </button>
      <button
        type="button"
        className="bar-btn"
        data-testid="terminal-search-close"
        title={t('common.close')}
        onClick={close}
      >
        ×
      </button>
    </div>
  );
}
