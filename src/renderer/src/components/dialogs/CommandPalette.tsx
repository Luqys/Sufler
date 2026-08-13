import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { filterActions, type PaletteItem, type PaletteMatch } from '../../../../shared/system/command-palette';
import { useT } from '../../i18n';

export interface PaletteAction extends PaletteItem {
  run(): void;
}

/** Pogrubienie trafionych znaków w etykiecie. */
function Highlighted({ label, positions }: { label: string; positions: number[] }): ReactElement {
  const hits = new Set(positions);
  return (
    <>
      {/* Indeks jest tożsamością znaku w tej etykiecie — lista jest statyczna. */}
      {[...label].map((char, index) => (
        <span key={index} className={hits.has(index) ? 'quick-open-hit' : undefined}>
          {char}
        </span>
      ))}
    </>
  );
}

/**
 * Paleta komend (Cmd+K, M74): panele, doki, motyw i ustawienia w jednym
 * miejscu. Nawigacja i wygląd jak w szybkim otwieraniu plików (Cmd+P),
 * żeby nie uczyć się dwóch nakładek.
 */
export function CommandPalette({
  actions,
  onClose,
}: {
  actions: PaletteAction[];
  onClose(): void;
}): ReactElement {
  const t = useT();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => filterActions(actions, query), [actions, query]);
  const clampedSelection = Math.min(selected, Math.max(0, matches.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector('.quick-open-item.selected')
      ?.scrollIntoView({ block: 'nearest' });
  }, [clampedSelection, matches]);

  const run = (match: PaletteMatch | undefined): void => {
    if (!match) {
      return;
    }
    onClose();
    (match.item as PaletteAction).run();
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
      run(matches[clampedSelection]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup: string | null = null;

  return (
    <div
      className="quick-open-overlay"
      data-testid="command-palette"
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
          data-testid="command-palette-input"
          type="text"
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
        />
        <div className="quick-open-list" ref={listRef}>
          {matches.length === 0 && <div className="quick-open-note">{t('palette.empty')}</div>}
          {matches.map((match, index) => {
            const header = match.item.group === lastGroup ? null : match.item.group;
            lastGroup = match.item.group;
            return (
              <div key={match.item.id}>
                {header !== null && <div className="palette-group">{header}</div>}
                <button
                  type="button"
                  className={`quick-open-item${index === clampedSelection ? ' selected' : ''}`}
                  data-testid="command-palette-item"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => run(match)}
                >
                  <span className="quick-open-path">
                    <Highlighted label={match.item.label} positions={match.positions} />
                  </span>
                  {match.item.hint !== undefined && (
                    <span className="palette-hint">{match.item.hint}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
