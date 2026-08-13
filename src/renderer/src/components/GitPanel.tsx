import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { assignLanes, maxLaneCount, type LaneRow } from '../../../shared/git-graph';
import type { StringKey } from '../../../shared/i18n';
import type { Checkpoint } from '../../../shared/checkpoints';
import type { GitCommit, GitCommitFile, GitLogResult, GitStatusFile } from '../../../shared/ipc';
import { getLocale, t, tf, useT } from '../i18n';
import { fullDateTime, relativeTime } from '../relative-time';
import { useDialogs } from '../ui-dialogs';
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

const STATUS_KEY: Record<string, StringKey> = {
  A: 'git.statusAdded',
  M: 'git.statusModified',
  D: 'git.statusDeleted',
  R: 'git.statusRenamed',
  C: 'git.statusCopied',
  T: 'git.statusTypeChange',
};

/** Etykieta statusu pliku w bieżącym języku (wywoływać w momencie renderu). */
function statusLabel(status: string): string {
  const key = STATUS_KEY[status];
  return key ? t(key) : status;
}

/** Daty commitów przychodzą jako ISO 8601 (%aI) — helpery liczą na milisekundach. */
const fullDate = (iso: string): string => fullDateTime(Date.parse(iso));
const relativeDate = (iso: string): string => relativeTime(Date.parse(iso));

/** Historia commitów repozytorium projektu (git log + diff-tree) + zmiany robocze. */
/** Punkty przywracania (M55): migawki drzewa sprzed tur Claude. */
function Checkpoints({ root }: { root: string }): ReactElement | null {
  const t = useT();
  const { confirmDialog, notify } = useDialogs();
  const [items, setItems] = useState<Checkpoint[]>([]);
  const subscribed = useRef(false);

  const refresh = useCallback(() => {
    void window.api.listCheckpoints(root).then(setItems);
  }, [root]);

  useEffect(() => {
    refresh();
    if (!subscribed.current) {
      subscribed.current = true;
      window.api.onCheckpointsChanged(refresh);
    }
  }, [refresh]);

  const restore = (checkpoint: Checkpoint): void => {
    void confirmDialog({
      title: t('checkpoints.restoreTitle'),
      message: tf('checkpoints.restoreMessage', { label: checkpoint.label }),
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      void window.api.restoreCheckpoint(root, checkpoint.hash).then((result) => {
        notify(
          result.ok ? t('checkpoints.restored') : t('checkpoints.restoreFailed'),
          result.ok ? 'success' : 'error',
        );
        refresh();
      });
    });
  };

  return (
    <details className="checkpoints" data-testid="checkpoints" open={items.length > 0}>
      <summary>
        {t('checkpoints.title')} <span className="group-count">{items.length}</span>
      </summary>
      <p className="checkpoints-hint placeholder">{t('checkpoints.hint')}</p>
      {items.length === 0 && <p className="placeholder">{t('checkpoints.empty')}</p>}
      {items.map((checkpoint) => (
        <div key={checkpoint.hash} className="checkpoint-row" data-testid="checkpoint-row">
          <span className="checkpoint-time">
            {new Date(checkpoint.date).toLocaleTimeString(getLocale(), {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="checkpoint-label" title={checkpoint.label}>
            {checkpoint.label}
          </span>
          <button
            type="button"
            className="bar-btn"
            data-testid="checkpoint-restore"
            onClick={() => restore(checkpoint)}
          >
            {t('checkpoints.restore')}
          </button>
        </div>
      ))}
    </details>
  );
}

export function GitPanel(): ReactElement {
  const t = useT();
  const { root, openDiffTab, openWorklogTab } = useWorkspace();
  const [result, setResult] = useState<GitLogResult | null>(null);
  const [changes, setChanges] = useState<GitStatusFile[]>([]);
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
    void window.api.gitStatus(forRoot).then((files) => {
      if (rootRef.current === forRoot) {
        setChanges(files);
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
          <span className="git-branch" title={tf('git.branch', { branch: result.branch })}>
            {ICON_BRANCH}
            <span className="git-branch-name">{result.branch}</span>
            <span className="git-count">{result.commits.length}</span>
          </span>
        ) : (
          <span className="mcp-note">{t('git.header')}</span>
        )}
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="worklog-open"
          title={t('worklog.open')}
          onClick={openWorklogTab}
        >
          ◷
        </button>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="git-refresh"
          title={t('git.refresh')}
          onClick={refresh}
        >
          {ICON_REFRESH}
        </button>
      </div>
      <Checkpoints root={root} />
      {result === null && <p className="placeholder">{t('git.loading')}</p>}
      {result !== null && !result.ok && <p className="placeholder">{t('git.notRepo')}</p>}
      {result?.ok && result.commits.length === 0 && (
        <p className="placeholder">{t('git.noCommits')}</p>
      )}
      {result?.ok && changes.length > 0 && (
        <div className="git-changes" data-testid="git-changes">
          <div className="view-title git-changes-title">{t('git.changesTitle')}</div>
          {changes.map((file) => (
            <button
              key={file.path}
              type="button"
              className="git-file git-change"
              data-testid="git-change-file"
              title={
                file.state === 'modified' ? t('git.statusModified') : t('git.statusUntracked')
              }
              onClick={() => openDiffTab({ kind: 'worktree', path: file.path })}
            >
              <span
                className={`git-status git-status-${file.state === 'modified' ? 'M' : 'U'}`}
              >
                {file.state === 'modified' ? 'M' : 'U'}
              </span>
              <span className="git-file-path">{file.path}</span>
            </button>
          ))}
        </div>
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
                      {commit.subject || t('git.noSubject')}
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
                        <div className="tree-note">{t('git.loadingFiles')}</div>
                      )}
                      {Array.isArray(commitFiles) && commitFiles.length === 0 && (
                        <div className="tree-note">{t('git.noFiles')}</div>
                      )}
                      {Array.isArray(commitFiles) &&
                        commitFiles.map((file) => (
                          <button
                            key={`${file.status}:${file.path}`}
                            type="button"
                            className="git-file git-change"
                            data-testid="git-commit-file"
                            title={statusLabel(file.status)}
                            onClick={() =>
                              openDiffTab({
                                kind: 'commit',
                                hash: commit.hash,
                                parent: commit.parents[0] ?? null,
                                path: file.path,
                                status: file.status,
                              })
                            }
                          >
                            <span className={`git-status git-status-${file.status}`}>
                              {file.status}
                            </span>
                            <span className="git-file-path">{file.path}</span>
                          </button>
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
