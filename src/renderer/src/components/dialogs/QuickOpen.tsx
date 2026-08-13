import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { filterPaths, type FuzzyMatch } from '../../../../shared/system/fuzzy';
import { useT } from '../../i18n';
import { useWorkspace } from '../../workspace';
import { fileIconFor } from '../sidebar/file-icons';
import { baseName } from '../../../../shared/editor/paths';

/** Pogrubienie trafionych znaków w ścieżce. */
function Highlighted({ match }: { match: FuzzyMatch }): ReactElement {
  const positions = new Set(match.positions);
  return (
    <>
      {/* Indeks jest tożsamością znaku w tej ścieżce — lista jest statyczna. */}
      {[...match.path].map((char, index) => (
        <span key={index} className={positions.has(index) ? 'quick-open-hit' : undefined}>
          {char}
        </span>
      ))}
    </>
  );
}

/** Szybkie otwieranie pliku (Cmd+P, M37): fuzzy po liście z `rg --files`. */
export function QuickOpen({ onClose }: { onClose(): void }): ReactElement {
  const { root, openFile } = useWorkspace();
  const t = useT();
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    void window.api.listProjectFiles(root).then((result) => {
      if (result.ok) {
        setFiles(result.files);
      } else {
        setError(result.error);
      }
    });
  }, [root]);

  const matches = useMemo(() => filterPaths(files, query, 50), [files, query]);
  const clampedSelection = Math.min(selected, Math.max(0, matches.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector('.quick-open-item.selected')
      ?.scrollIntoView({ block: 'nearest' });
  }, [clampedSelection, matches]);

  const open = (match: FuzzyMatch | undefined): void => {
    if (!match) {
      return;
    }
    openFile(`${root}/${match.path}`);
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(Math.min(clampedSelection + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(Math.max(clampedSelection - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      open(matches[clampedSelection]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="quick-open-overlay"
      data-testid="quick-open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="quick-open-panel">
        <input
          ref={inputRef}
          className="quick-open-input"
          data-testid="quick-open-input"
          type="text"
          placeholder={t('quickOpen.placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
        />
        <div className="quick-open-list" ref={listRef}>
          {error !== null && <div className="quick-open-note">{error}</div>}
          {error === null && matches.length === 0 && (
            <div className="quick-open-note">{t('quickOpen.empty')}</div>
          )}
          {matches.map((match, index) => (
            <button
              key={match.path}
              type="button"
              className={`quick-open-item${index === clampedSelection ? ' selected' : ''}`}
              data-testid="quick-open-item"
              onMouseEnter={() => setSelected(index)}
              onClick={() => open(match)}
            >
              <span className="tree-icon">{fileIconFor(baseName(match.path))}</span>
              <span className="quick-open-path">
                <Highlighted match={match} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
