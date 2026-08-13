import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { baseSideFor, type BranchDiff } from '../../../../shared/git/branch-diff';
import {
  validateWorktreeName,
  worktreeLabel,
  type Worktree,
} from '../../../../shared/git/worktrees';
import { tf, useT } from '../../i18n';
import { useDocks } from '../../docks';
import { useDialogs } from '../../ui-dialogs';
import { useWorkspace } from '../../workspace';

const ICON_CLAUDE = <span aria-hidden>✳</span>;

/**
 * Worktree'y projektu (M72): kilka sesji Claude nad jednym zadaniem, każda
 * w osobnym katalogu roboczym. Aplikacja tworzy katalog sama (`git worktree
 * add`), bo `claude --worktree` wybrałby go po swojemu i drzewo plików ani
 * panel Git nie wiedziałyby o nowym korzeniu.
 */
export function Worktrees({ root }: { root: string }): ReactElement | null {
  const t = useT();
  const { addTab } = useDocks();
  const { openDiffTab } = useWorkspace();
  const { confirmDialog, notify } = useDialogs();
  const [items, setItems] = useState<Worktree[] | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [diffs, setDiffs] = useState<ReadonlyMap<string, BranchDiff | 'loading' | 'none'>>(
    new Map(),
  );

  const refresh = useCallback(() => {
    void window.api.listWorktrees(root).then(setItems);
  }, [root]);

  useEffect(refresh, [refresh]);

  // Projekt bez repozytorium (albo bez dodatkowych worktree'ów) nie potrzebuje sekcji.
  if (items === null || items.length === 0) {
    return null;
  }

  const create = (): void => {
    const trimmed = name.trim();
    if (creating || validateWorktreeName(trimmed) !== null) {
      return;
    }
    setCreating(true);
    void window.api.addWorktree(root, trimmed).then((result) => {
      setCreating(false);
      if (result.ok) {
        setName('');
        notify(tf('worktree.created', { name: trimmed }), 'success');
        // Nowy katalog od razu z sesją Claude — po to się go zakłada.
        addTab('right', 'claude', { cwd: result.path, title: trimmed });
      } else {
        notify(t(result.error === 'exists' ? 'worktree.exists' : 'worktree.createFailed'), 'error');
      }
      refresh();
    });
  };

  /**
   * Co ten worktree wniósł wobec gałęzi projektu. Liczone na żądanie —
   * rozwinięcie wiersza, nie ładowanie wszystkiego przy otwarciu panelu.
   */
  const toggleDiff = (worktree: Worktree): void => {
    const current = diffs.get(worktree.branch);
    if (current !== undefined) {
      setDiffs((prev) => {
        const next = new Map(prev);
        next.delete(worktree.branch);
        return next;
      });
      return;
    }
    setDiffs((prev) => new Map(prev).set(worktree.branch, 'loading'));
    const base = items?.find((item) => item.main)?.branch ?? '';
    void window.api.diffWorktree(root, worktree.branch, base).then((result) => {
      setDiffs((prev) => new Map(prev).set(worktree.branch, result ?? 'none'));
    });
  };

  const merge = (worktree: Worktree): void => {
    void confirmDialog({
      title: t('worktree.mergeTitle'),
      message: tf('worktree.mergeMessage', { branch: worktree.branch }),
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      void window.api.mergeWorktree(root, worktree.branch).then((result) => {
        // Po scaleniu policzona różnica jest nieaktualna z definicji.
        setDiffs((prev) => {
          const next = new Map(prev);
          next.delete(worktree.branch);
          return next;
        });
        if (result.ok) {
          notify(tf('worktree.merged', { branch: worktree.branch, into: result.into }), 'success');
        } else if (result.error === 'conflict') {
          // Konfliktów nie rozwiązuje automat — merge został przerwany.
          notify(tf('worktree.conflict', { branch: worktree.branch }), 'error');
        } else {
          notify(t('worktree.mergeFailed'), 'error');
        }
        refresh();
      });
    });
  };

  const remove = (worktree: Worktree): void => {
    void confirmDialog({
      title: t('worktree.removeTitle'),
      message: tf('worktree.removeMessage', { path: worktree.path }),
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      void window.api.removeWorktree(root, worktree.path).then((result) => {
        if (!result.ok) {
          notify(t(result.error === 'dirty' ? 'worktree.dirty' : 'worktree.removeFailed'), 'error');
        }
        refresh();
      });
    });
  };

  return (
    <details className="worktrees" data-testid="worktrees" open>
      <summary>
        {t('worktree.title')} <span className="group-count">{items.length}</span>
      </summary>
      {items.map((worktree) => (
        <div key={worktree.path} className="worktree-row" data-testid="worktree-row">
          <span className="worktree-name" title={worktree.path}>
            {worktreeLabel(worktree)}
          </span>
          {worktree.main ? (
            <span className="badge">{t('worktree.mainBadge')}</span>
          ) : (
            <span className="worktree-actions">
              <button
                type="button"
                className="bar-btn"
                data-testid="worktree-session"
                title={t('worktree.session')}
                onClick={() =>
                  addTab('right', 'claude', {
                    cwd: worktree.path,
                    title: worktreeLabel(worktree),
                  })
                }
              >
                {ICON_CLAUDE}
              </button>
              <button
                type="button"
                className="bar-btn"
                data-testid="worktree-diff"
                title={t('worktree.diff')}
                onClick={() => toggleDiff(worktree)}
              >
                ±
              </button>
              <button
                type="button"
                className="bar-btn"
                data-testid="worktree-merge"
                title={t('worktree.merge')}
                onClick={() => merge(worktree)}
              >
                {t('worktree.mergeShort')}
              </button>
              <button
                type="button"
                className="bar-btn"
                data-testid="worktree-remove"
                title={t('worktree.remove')}
                onClick={() => remove(worktree)}
              >
                ×
              </button>
            </span>
          )}
          {(() => {
            const diff = diffs.get(worktree.branch);
            if (diff === undefined) {
              return null;
            }
            if (diff === 'loading') {
              return <span className="tree-note">{t('worktree.diffLoading')}</span>;
            }
            if (diff === 'none') {
              // null z IPC = porównania nie dało się policzyć (odłączona baza,
              // zniknięta gałąź) — to co innego niż „nic nie wniosła".
              return (
                <span className="tree-note" data-testid="worktree-diff-unavailable">
                  {t('worktree.diffUnavailable')}
                </span>
              );
            }
            if (diff.files.length === 0) {
              return (
                <span className="tree-note" data-testid="worktree-diff-empty">
                  {t('worktree.diffEmpty')}
                </span>
              );
            }
            return (
              <span className="worktree-diff" data-testid="worktree-diff-list">
                {diff.files.map((file) => (
                  <button
                    key={`${file.status}:${file.path}`}
                    type="button"
                    className="git-file git-change"
                    data-testid="worktree-diff-file"
                    onClick={() =>
                      openDiffTab({
                        kind: 'commit',
                        hash: diff.tip,
                        parent: baseSideFor(file, diff.mergeBase),
                        path: file.path,
                        status: file.status,
                      })
                    }
                  >
                    <span className={`git-status git-status-${file.status}`}>{file.status}</span>
                    <span className="git-file-path">{file.path}</span>
                  </button>
                ))}
              </span>
            );
          })()}
        </div>
      ))}
      <div className="worktree-form">
        <input
          type="text"
          className="worktree-input"
          data-testid="worktree-name"
          placeholder={t('worktree.namePlaceholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              create();
            }
          }}
        />
        <button
          type="button"
          className="bar-btn worktree-new"
          data-testid="worktree-new"
          disabled={creating || validateWorktreeName(name.trim()) !== null}
          title={t('worktree.newHint')}
          onClick={create}
        >
          {t('worktree.new')}
        </button>
      </div>
    </details>
  );
}
