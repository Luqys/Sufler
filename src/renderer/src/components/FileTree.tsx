import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import type { DirEntry, TreeChangedEvent } from '../../../shared/ipc';
import { baseName } from '../../../shared/paths';
import { useWorkspace } from '../workspace';

type Listing =
  | { status: 'loaded'; entries: DirEntry[] }
  | { status: 'error'; message: string };

type GitState = 'modified' | 'untracked';

const ICON_CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const ICON_FILE = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M4 1.8h5.2L13.5 6v7.2a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1V2.8a1 1 0 0 1 1-1Z" />
    <path d="M9.2 1.8V6h4.3" />
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
  const { root, tabsState, openFile, chooseProject } = useWorkspace();
  const [listings, setListings] = useState<ReadonlyMap<string, Listing>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);
  const [gitFiles, setGitFiles] = useState<ReadonlyMap<string, GitState>>(new Map());
  const listingsRef = useRef(listings);
  const pendingDirs = useRef(new Set<string>());
  const debounceTimer = useRef<number | null>(null);

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
          ? { status: 'loaded', entries: result.entries }
          : { status: 'error', message: result.error },
      );
      return next;
    });
  }, []);

  const refreshGitStatus = useCallback(() => {
    void window.api.gitStatus(root).then((files) => {
      setGitFiles(new Map(files.map((file) => [`${root}/${file.path}`, file.state])));
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

  const renderDir = (dirPath: string, depth: number): ReactElement | ReactElement[] => {
    const indent: CSSProperties = { paddingLeft: 10 + depth * 14 };
    const listing = listings.get(dirPath);
    if (!listing) {
      return (
        <div className="tree-note" style={indent}>
          Wczytywanie…
        </div>
      );
    }
    if (listing.status === 'error') {
      return (
        <div className="tree-note" style={indent} title={listing.message}>
          Brak dostępu
        </div>
      );
    }
    const visible = listing.entries.filter((entry) => showIgnored || !entry.ignored);
    if (visible.length === 0) {
      return (
        <div className="tree-note" style={indent}>
          (pusto)
        </div>
      );
    }
    return visible.map((entry) => {
      const isOpen = entry.kind === 'dir' && expanded.has(entry.path);
      const gitState =
        entry.kind === 'file'
          ? gitFiles.get(entry.path)
          : (gitFiles.get(entry.path) ?? gitDirs.get(entry.path));
      const classes = ['tree-row'];
      if (entry.ignored) {
        classes.push('ignored');
      }
      if (tabsState.activePath === entry.path) {
        classes.push('selected');
      }
      if (gitState) {
        classes.push(`git-${gitState}`);
      }
      return (
        <div key={entry.path}>
          <button
            type="button"
            className={classes.join(' ')}
            style={indent}
            title={entry.path}
            onClick={() => (entry.kind === 'dir' ? toggleDir(entry.path) : openFile(entry.path))}
            onDoubleClick={() => {
              if (entry.kind === 'file') {
                openFile(entry.path, { pinned: true });
              }
            }}
          >
            <span className={`tree-icon${isOpen ? ' open' : ''}`}>
              {entry.kind === 'dir' ? ICON_CHEVRON : ICON_FILE}
            </span>
            <span className="tree-name">{entry.name}</span>
          </button>
          {isOpen && <div role="group">{renderDir(entry.path, depth + 1)}</div>}
        </div>
      );
    });
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
          title="Otwórz folder projektu…"
          onClick={chooseProject}
        >
          {ICON_OPEN_FOLDER}
        </button>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="refresh-tree"
          title="Odśwież drzewo"
          onClick={refresh}
        >
          {ICON_REFRESH}
        </button>
        <button
          type="button"
          className={`tree-toolbtn${showIgnored ? ' active' : ''}`}
          data-testid="toggle-ignored"
          title="Pokaż pliki ignorowane przez .gitignore"
          aria-pressed={showIgnored}
          onClick={() => setShowIgnored((value) => !value)}
        >
          {ICON_EYE}
        </button>
      </div>
      <div className="tree-scroll" data-testid="file-tree">
        {renderDir(root, 0)}
      </div>
    </div>
  );
}
