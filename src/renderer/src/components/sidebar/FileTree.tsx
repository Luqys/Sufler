import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactElement,
} from 'react';
import { activeGroup } from '../../../../shared/editor/editor-groups';
import type { DirEntry, TreeChangedEvent } from '../../../../shared/ipc';
import { baseName } from '../../../../shared/editor/paths';
import { tf, tp, useT } from '../../i18n';
import { useWorkspace } from '../../workspace';
import { FOLDER_ICON, fileIconFor } from './file-icons';

type Listing =
  | { status: 'loaded'; entries: DirEntry[]; hidden: number }
  | { status: 'error'; message: string };

type GitState = 'modified' | 'untracked';

const ICON_CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const ICON_OPEN_FOLDER = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    <path d="M1.8 3.5a1 1 0 0 1 1-1h3.4l1.6 1.8h5.4a1 1 0 0 1 1 1v1H3.4l-1.6 6.4V3.5Z" />
    <path d="M3.4 6.3h11.4l-1.7 6.4H1.8l1.6-6.4Z" />
  </svg>
);

const ICON_REFRESH = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
    <path d="M13.6 1.8v2.8h-2.8" />
  </svg>
);

const ICON_EYE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

// Jedna subskrypcja IPC na życie okna; komponent podmienia handler przy remoncie.
let treeChangedHandler: ((event: TreeChangedEvent) => void) | null = null;
let treeSubscribed = false;
function ensureTreeSubscription(): void {
  if (!treeSubscribed) {
    treeSubscribed = true;
    window.api.onTreeChanged((event) => treeChangedHandler?.(event));
  }
}

export function FileTree(): ReactElement {
  const t = useT();
  const { root, groups, openFile, chooseProject } = useWorkspace();
  const activePath = activeGroup(groups).activePath;
  const [listings, setListings] = useState<ReadonlyMap<string, Listing>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);
  const [gitFiles, setGitFiles] = useState<ReadonlyMap<string, GitState>>(new Map());
  const [dropDir, setDropDir] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const listingsRef = useRef(listings);
  const pendingDirs = useRef(new Set<string>());
  const debounceTimer = useRef<number | null>(null);
  const noteTimer = useRef<number | null>(null);

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  const load = useCallback(async (dirPath: string) => {
    const result = await window.api.readDir(dirPath);
    setListings((prev) => {
      const next = new Map(prev);
      next.set(
        dirPath,
        result.ok
          ? { status: 'loaded', entries: result.entries, hidden: result.hidden }
          : { status: 'error', message: result.error },
      );
      return next;
    });
  }, []);

  const refreshGitStatus = useCallback(() => {
    void window.api.gitStatus(root).then((files) => {
      const next = new Map<string, GitState>();
      for (const file of files) {
        next.set(`${root}/${file.path}`, file.state);
      }
      setGitFiles(next);
    });
  }, [root]);

  useEffect(() => {
    void load(root);
    refreshGitStatus();
  }, [load, refreshGitStatus, root]);

  // Obserwujemy wyłącznie korzeń + rozwinięte katalogi (ryzyko nr 3 ze SPEC.md).
  useEffect(() => {
    void window.api.watchTreeDirs([root, ...expanded]);
  }, [root, expanded]);

  useEffect(() => {
    const handle = (event: TreeChangedEvent): void => {
      const slash = event.path.lastIndexOf('/');
      const parent = slash > 0 ? event.path.slice(0, slash) : event.path;
      pendingDirs.current.add(parent);
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(() => {
        debounceTimer.current = null;
        const dirs = [...pendingDirs.current];
        pendingDirs.current.clear();
        for (const dir of dirs) {
          if (listingsRef.current.has(dir)) {
            void load(dir);
          }
        }
        refreshGitStatus();
      }, 300);
    };
    treeChangedHandler = handle;
    ensureTreeSubscription();
    return () => {
      if (treeChangedHandler === handle) {
        treeChangedHandler = null;
      }
    };
  }, [load, refreshGitStatus]);

  /** Kolor katalogów-przodków zmienionych plików; „modified" wygrywa z „untracked". */
  const gitDirs = useMemo(() => {
    const dirs = new Map<string, GitState>();
    for (const [path, state] of gitFiles) {
      let current = path;
      while (current.length > root.length) {
        current = current.slice(0, current.lastIndexOf('/'));
        if (current.length <= root.length) {
          break;
        }
        const previous = dirs.get(current);
        dirs.set(
          current,
          previous === 'modified' || state === 'modified' ? 'modified' : 'untracked',
        );
      }
    }
    return dirs;
  }, [gitFiles, root]);

  const toggleDir = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    if (!listings.has(path)) {
      void load(path);
    }
  };

  const refresh = (): void => {
    for (const dir of new Set([root, ...listings.keys()])) {
      void load(dir);
    }
    refreshGitStatus();
  };

  /* ── Import przeciąganiem z systemu (M61) ─────────────────────── */

  const showImportNote = (text: string): void => {
    setImportNote(text);
    if (noteTimer.current !== null) {
      window.clearTimeout(noteTimer.current);
    }
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null;
      setImportNote(null);
    }, 6000);
  };

  const hasOsFiles = (event: DragEvent): boolean =>
    event.dataTransfer.types.includes('Files');

  /** Cel importu dla wiersza: katalog wprost, dla pliku — jego rodzic. */
  const dropTargetFor = (entry: DirEntry): string =>
    entry.kind === 'dir' ? entry.path : entry.path.slice(0, entry.path.lastIndexOf('/'));

  const handleDragOver = (target: string) => (event: DragEvent): void => {
    if (!hasOsFiles(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (dropDir !== target) {
      setDropDir(target);
    }
  };

  const handleDrop = (target: string) => (event: DragEvent): void => {
    if (!hasOsFiles(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDropDir(null);
    const sources = [...event.dataTransfer.files]
      .map((file) => window.api.pathForFile(file))
      .filter((path) => path.length > 0);
    if (sources.length === 0) {
      return;
    }
    void window.api.importPaths(root, target, sources).then((result) => {
      if (!result.ok) {
        showImportNote(t('ft.importFailed'));
        return;
      }
      const parts: string[] = [];
      if (result.copied > 0) {
        parts.push(tf('ft.importDone', { count: tp('unit.items', result.copied) }));
      }
      if (result.skipped.length > 0) {
        const names = result.skipped.slice(0, 3).map((skip) => skip.name);
        const suffix = result.skipped.length > 3 ? '…' : '';
        parts.push(tf('ft.importSkipped', { names: names.join(', ') + suffix }));
      }
      if (parts.length > 0) {
        showImportNote(parts.join(' · '));
      }
      refresh();
    });
  };

  const handleTreeDragLeave = (event: DragEvent): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropDir(null);
    }
  };

  const renderDir = (dirPath: string, depth: number): ReactElement | ReactElement[] => {
    const indent: CSSProperties = { paddingLeft: 10 + depth * 14 };
    const listing = listings.get(dirPath);
    if (!listing) {
      return (
        <div className="tree-note" style={indent}>
          {t('common.loading')}
        </div>
      );
    }
    if (listing.status === 'error') {
      return (
        <div className="tree-note" style={indent} title={listing.message}>
          {t('ft.noAccess')}
        </div>
      );
    }
    const visible = listing.entries.filter((entry) => showIgnored || !entry.ignored);
    if (visible.length === 0) {
      return (
        <div className="tree-note" style={indent}>
          {t('ft.empty')}
        </div>
      );
    }
    // Katalog przycięty limitem (M88) — mówimy o tym wprost, zamiast po cichu
    // pokazywać niepełną listę.
    const nadmiar =
      listing.hidden > 0 ? (
        <div className="tree-note tree-capped" style={indent} data-testid="tree-capped" key="capped">
          {tf('ft.capped', { count: String(listing.hidden) })}
        </div>
      ) : null;
    const wiersze = visible.map((entry) => {
      const isOpen = entry.kind === 'dir' && expanded.has(entry.path);
      const gitState =
        entry.kind === 'file'
          ? gitFiles.get(entry.path)
          : (gitFiles.get(entry.path) ?? gitDirs.get(entry.path));
      const classes = ['tree-row'];
      if (entry.ignored) {
        classes.push('ignored');
      }
      if (activePath === entry.path) {
        classes.push('selected');
      }
      if (gitState) {
        classes.push(`git-${gitState}`);
      }
      if (dropDir !== null && dropDir === entry.path) {
        classes.push('drop-target');
      }
      return (
        <div key={entry.path}>
          <button
            type="button"
            className={classes.join(' ')}
            style={indent}
            title={entry.path}
            onClick={() => {
              if (entry.kind === 'dir') {
                toggleDir(entry.path);
                return;
              }
              openFile(entry.path);
            }}
            onDoubleClick={() => {
              if (entry.kind === 'file') {
                openFile(entry.path, { pinned: true });
              }
            }}
            onDragOver={handleDragOver(dropTargetFor(entry))}
            onDrop={handleDrop(dropTargetFor(entry))}
          >
            {entry.kind === 'dir' ? (
              <>
                <span className={`tree-icon${isOpen ? ' open' : ''}`}>{ICON_CHEVRON}</span>
                <span className="tree-icon">{FOLDER_ICON}</span>
              </>
            ) : (
              <span className="tree-icon">{fileIconFor(entry.name)}</span>
            )}
            <span className="tree-name">{entry.name}</span>
          </button>
          {isOpen && <div role="group">{renderDir(entry.path, depth + 1)}</div>}
        </div>
      );
    });
    return nadmiar === null ? wiersze : [...wiersze, nadmiar];
  };

  return (
    <div className="file-tree">
      <div className="tree-header">
        <h2 className="view-title" title={root}>
          {baseName(root)}
        </h2>
        <button
          type="button"
          className="tree-toolbtn"
          title={t('ft.openProject')}
          onClick={chooseProject}
        >
          {ICON_OPEN_FOLDER}
        </button>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="refresh-tree"
          title={t('ft.refresh')}
          onClick={refresh}
        >
          {ICON_REFRESH}
        </button>
        <button
          type="button"
          className={`tree-toolbtn${showIgnored ? ' active' : ''}`}
          data-testid="toggle-ignored"
          title={t('ft.showIgnored')}
          aria-pressed={showIgnored}
          onClick={() => setShowIgnored((value) => !value)}
        >
          {ICON_EYE}
        </button>
      </div>
      <div
        className={`tree-scroll${dropDir === root ? ' drop-target' : ''}`}
        data-testid="file-tree"
        onDragOver={handleDragOver(root)}
        onDrop={handleDrop(root)}
        onDragLeave={handleTreeDragLeave}
      >
        {renderDir(root, 0)}
      </div>
      {importNote !== null && (
        <div className="tree-import-note" data-testid="import-note">
          {importNote}
        </div>
      )}
    </div>
  );
}
