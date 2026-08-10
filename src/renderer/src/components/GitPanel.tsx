import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { assignLanes, maxLaneCount, type LaneRow } from '../../../shared/git-graph';
import type { GitCommit, GitCommitFile, GitLogResult } from '../../../shared/ipc';
import { useWorkspace } from '../workspace';

/** Paleta torów gałęzi (indeks kolumny → kolor). */
const LANE_COLORS = ['#d97757', '#2563eb', '#16a34a', '#a855f7', '#db2777', '#0891b2', '#f59e0b'];

const DOT_Y = 15;
const laneX = (index: number): number => 7 + index * 10;
const laneColor = (index: number): string => LANE_COLORS[index % LANE_COLORS.length] ?? '#888';

/** Tor gałęzi jednego wiersza: kropka + linie kontynuacji/merge/rozgałęzień. */
function LaneRail({
  row,
  hash,
  parents,
}: {
  row: LaneRow;
  hash: string;
  parents: string[];
}): ReactElement {
  const cols = Math.max(row.before.length, row.after.length, row.lane + 1);
  const segments: ReactElement[] = [];
  for (let i = 0; i < cols; i += 1) {
    const before = row.before[i] ?? null;
    const after = row.after[i] ?? null;
    if (i !== row.lane) {
      if (before === hash) {
        // Gałąź wpadająca do tego commita (merge).
        segments.push(
          <line key={`m${i}`} x1={laneX(i)} y1={0} x2={laneX(row.lane)} y2={DOT_Y} stroke={laneColor(i)} />,
        );
      } else if (before !== null && before === after) {
        segments.push(
          <line key={`c${i}`} x1={laneX(i)} y1={0} x2={laneX(i)} y2="100%" stroke={laneColor(i)} />,
        );
      }
      if (after !== null && before !== after && parents.includes(after)) {
        // Drugi rodzic merge'a odchodzi w nową kolumnę.
        segments.push(
          <line key={`b${i}`} x1={laneX(row.lane)} y1={DOT_Y} x2={laneX(i)} y2="100%" stroke={laneColor(i)} />,
        );
      }
    }
  }
  if (row.before[row.lane] === hash) {
    segments.push(
      <line key="in" x1={laneX(row.lane)} y1={0} x2={laneX(row.lane)} y2={DOT_Y} stroke={laneColor(row.lane)} />,
    );
  }
  if (row.after[row.lane] != null) {
    segments.push(
      <line key="out" x1={laneX(row.lane)} y1={DOT_Y} x2={laneX(row.lane)} y2="100%" stroke={laneColor(row.lane)} />,
    );
  }
  segments.push(<circle key="dot" cx={laneX(row.lane)} cy={DOT_Y} r={3.6} fill={laneColor(row.lane)} />);
  return (
    <span className="git-rail" aria-hidden>
      <svg width="100%" height="100%" strokeWidth={1.6}>
        {segments}
      </svg>
    </span>
  );
}

const ICON_REFRESH = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
    <path d="M13.6 1.8v2.8h-2.8" />
  </svg>
);

const ICON_BRANCH = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="4.5" cy="3.5" r="1.9" />
    <circle cx="4.5" cy="12.5" r="1.9" />
    <circle cx="11.5" cy="5.5" r="1.9" />
    <path d="M4.5 5.4v5.2M11.5 7.4a5 5 0 0 1-5 3.2" />
  </svg>
);

const STATUS_LABEL: Record<string, string> = {
  A: 'dodany',
  M: 'zmieniony',
  D: 'usunięty',
  R: 'przeniesiony',
  C: 'skopiowany',
  T: 'zmiana typu',
};

function fullDate(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return '';
  }
  return then.toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' });
}

function relativeDate(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) {
    return 'przed chwilą';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min temu`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} godz. temu`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days} dn. temu`;
  }
  return new Date(then).toLocaleDateString('pl-PL');
}

/** Historia commitów repozytorium projektu (git log + diff-tree). */
export function GitPanel(): ReactElement {
  const { root } = useWorkspace();
  const [result, setResult] = useState<GitLogResult | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [details, setDetails] = useState<ReadonlyMap<string, GitCommitFile[] | 'loading'>>(
    new Map(),
  );
  const rootRef = useRef(root);
  rootRef.current = root;

  const refresh = useCallback(() => {
    const forRoot = rootRef.current;
    void window.api.gitLog(forRoot).then((log) => {
      if (rootRef.current === forRoot) {
        setResult(log);
        setDetails(new Map());
        setExpanded(new Set());
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const lanes = useMemo(
    () =>
      result?.ok
        ? assignLanes(result.commits.map((c) => ({ hash: c.hash, parents: c.parents ?? [] })))
        : [],
    [result],
  );
  const railWidth = 10 + maxLaneCount(lanes) * 10;

  const toggleCommit = (commit: GitCommit): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(commit.hash)) {
        next.delete(commit.hash);
      } else {
        next.add(commit.hash);
      }
      return next;
    });
    if (!details.has(commit.hash)) {
      setDetails((prev) => new Map(prev).set(commit.hash, 'loading'));
      void window.api.gitShowCommit(rootRef.current, commit.hash).then((files) => {
        setDetails((prev) => new Map(prev).set(commit.hash, files));
      });
    }
  };

  return (
    <div className="git-panel" data-testid="git-panel">
      <div className="git-toolbar">
        {result?.ok ? (
          <span className="git-branch" title={`Gałąź: ${result.branch}`}>
            {ICON_BRANCH}
            <span className="git-branch-name">{result.branch}</span>
            <span className="git-count">{result.commits.length}</span>
          </span>
        ) : (
          <span className="mcp-note">Historia commitów</span>
        )}
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="git-refresh"
          title="Odśwież historię"
          onClick={refresh}
        >
          {ICON_REFRESH}
        </button>
      </div>
      {result === null && <p className="placeholder">Czytam historię…</p>}
      {result !== null && !result.ok && (
        <p className="placeholder">
          To nie jest repozytorium git — zainicjuj je przez `git init` w terminalu.
        </p>
      )}
      {result?.ok && result.commits.length === 0 && (
        <p className="placeholder">Brak commitów w repozytorium.</p>
      )}
      <div className="git-list">
        {result?.ok &&
          result.commits.map((commit, index) => {
            const isOpen = expanded.has(commit.hash);
            const commitFiles = details.get(commit.hash);
            const row = lanes[index];
            return (
              <div
                key={commit.hash}
                className={`git-commit${isOpen ? ' open' : ''}`}
                data-testid="git-commit"
                style={{ paddingLeft: railWidth }}
              >
                {row && <LaneRail row={row} hash={commit.hash} parents={commit.parents ?? []} />}
                <button type="button" className="git-row" onClick={() => toggleCommit(commit)}>
                  <span className="git-row-main">
                    <span className="git-subject" title={commit.subject}>
                      {commit.subject || '(bez opisu)'}
                    </span>
                    <span className="git-meta">
                      <span className="git-hash">{commit.shortHash}</span>
                      <span className="git-author">{commit.author}</span>
                      <span className="git-when" title={fullDate(commit.date)}>
                        {relativeDate(commit.date)}
                      </span>
                    </span>
                  </span>
                  <span className={`mcp-chevron${isOpen ? ' open' : ''}`}>▸</span>
                </button>
                {isOpen && (
                  <div className="git-details">
                    <div className="git-detail-date">{fullDate(commit.date)}</div>
                    {commit.body && (
                      <pre className="git-body" data-testid="git-body">
                        {commit.body}
                      </pre>
                    )}
                    <div className="git-files">
                      {commitFiles === 'loading' && (
                        <div className="tree-note">Wczytywanie zmian…</div>
                      )}
                      {Array.isArray(commitFiles) && commitFiles.length === 0 && (
                        <div className="tree-note">Brak zmian plików.</div>
                      )}
                      {Array.isArray(commitFiles) &&
                        commitFiles.map((file) => (
                          <div
                            key={`${file.status}:${file.path}`}
                            className="git-file"
                            title={STATUS_LABEL[file.status] ?? file.status}
                          >
                            <span className={`git-status git-status-${file.status}`}>
                              {file.status}
                            </span>
                            <span className="git-file-path">{file.path}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
