import { useEffect, useRef, useState, type ReactElement } from 'react';
import { parseDiffPath, type DiffDescriptor } from '../../../shared/diff-tabs';
import { useT } from '../i18n';
import { getPendingDiff, updatePendingContents } from '../ide/pending-diffs';
import { monaco } from '../monaco-setup';
import { useWorkspace } from '../workspace';

/** Unikalne URI modeli diffa — poza rejestrem modeli plików (editor/models). */
let diffInstanceCounter = 0;

interface DiffSides {
  original: string;
  modified: string;
  /** Strona proponowana edytowalna tylko dla diffów z sesji Claude. */
  editable: boolean;
}

async function contentFromRevision(root: string, rev: string, path: string): Promise<string> {
  const result = await window.api.gitShowFile(root, rev, path);
  if (result.ok) {
    return result.content;
  }
  if (result.error === 'absent') {
    return '';
  }
  throw new Error(result.error);
}

async function contentFromDisk(path: string): Promise<string> {
  const result = await window.api.readFile(path);
  return result.ok ? result.content : '';
}

async function loadSides(root: string, descriptor: DiffDescriptor): Promise<DiffSides> {
  switch (descriptor.kind) {
    case 'worktree':
      return {
        original: await contentFromRevision(root, 'HEAD', descriptor.path),
        modified: await contentFromDisk(`${root}/${descriptor.path}`),
        editable: false,
      };
    case 'commit':
      return {
        original: descriptor.parent
          ? await contentFromRevision(root, descriptor.parent, descriptor.path)
          : '',
        modified:
          descriptor.status === 'D'
            ? ''
            : await contentFromRevision(root, descriptor.hash, descriptor.path),
        editable: false,
      };
    case 'ide': {
      const pendingDiff = getPendingDiff(descriptor.requestId);
      if (!pendingDiff) {
        throw new Error('expired');
      }
      return {
        original: await contentFromDisk(descriptor.oldPath),
        modified: pendingDiff.newContents,
        editable: true,
      };
    }
  }
}

/** Nazwa pliku do URI modelu — po niej Monaco dobiera gramatykę składni. */
function diffFileName(descriptor: DiffDescriptor): string {
  const path =
    descriptor.kind === 'ide' ? descriptor.newPath || descriptor.oldPath : descriptor.path;
  return path.split('/').pop() ?? 'plik.txt';
}

/**
 * Zakładka diffa (M33): side-by-side Monaco DiffEditor. Trzy źródła:
 * zmiany robocze vs HEAD, zmiana z commita, propozycja openDiff z sesji
 * Claude (z paskiem Zastosuj/Odrzuć — CLI czeka na tę decyzję).
 */
export function DiffView({ path }: { path: string }): ReactElement {
  const t = useT();
  const { root, acceptIdeDiff, rejectIdeDiff } = useWorkspace();
  const hostRef = useRef<HTMLDivElement>(null);
  const modifiedModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const descriptor = parseDiffPath(path);

  useEffect(() => {
    setError(null);
    setLoaded(false);
    const host = hostRef.current;
    if (!host || !descriptor) {
      return;
    }
    let disposed = false;
    let editor: monaco.editor.IStandaloneDiffEditor | null = null;
    let original: monaco.editor.ITextModel | null = null;
    let modified: monaco.editor.ITextModel | null = null;

    void loadSides(root, descriptor)
      .then((sides) => {
        if (disposed) {
          return;
        }
        const instance = ++diffInstanceCounter;
        const fileName = diffFileName(descriptor);
        original = monaco.editor.createModel(
          sides.original,
          undefined,
          monaco.Uri.from({ scheme: 'vn3o-diff', path: `/${instance}/original/${fileName}` }),
        );
        modified = monaco.editor.createModel(
          sides.modified,
          undefined,
          monaco.Uri.from({ scheme: 'vn3o-diff', path: `/${instance}/modified/${fileName}` }),
        );
        modifiedModelRef.current = modified;
        editor = monaco.editor.createDiffEditor(host, {
          automaticLayout: true,
          renderSideBySide: true,
          readOnly: !sides.editable,
          originalEditable: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
        });
        editor.setModel({ original, modified });
        setLoaded(true);
      })
      .catch((loadError: Error) => {
        if (!disposed) {
          setError(loadError.message);
        }
      });

    return () => {
      disposed = true;
      // Edycje propozycji przeżywają odmontowanie (przełączenie zakładki).
      if (descriptor.kind === 'ide' && modifiedModelRef.current) {
        updatePendingContents(descriptor.requestId, modifiedModelRef.current.getValue());
      }
      modifiedModelRef.current = null;
      editor?.dispose();
      original?.dispose();
      modified?.dispose();
    };
    // Deskryptor jest zakodowany w path — sam path wystarcza jako zależność.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, root]);

  if (!descriptor) {
    return (
      <div className="editor-empty-wrap">
        <p className="placeholder">{t('diff.unavailable')}</p>
      </div>
    );
  }

  const pendingActive =
    descriptor.kind === 'ide' && getPendingDiff(descriptor.requestId)?.responded === false;

  return (
    <div className="diff-view" data-testid="diff-view">
      {descriptor.kind === 'ide' && (
        <div className="diff-bar" data-testid="diff-bar">
          <span className="diff-bar-label">
            {descriptor.newPath || descriptor.oldPath}
          </span>
          {pendingActive && (
            <>
              <button
                type="button"
                className="bar-btn diff-accept"
                data-testid="diff-accept"
                onClick={() =>
                  acceptIdeDiff(descriptor, modifiedModelRef.current?.getValue() ?? null)
                }
              >
                {t('diff.accept')}
              </button>
              <button
                type="button"
                className="bar-btn"
                data-testid="diff-reject"
                onClick={() => rejectIdeDiff(descriptor)}
              >
                {t('diff.reject')}
              </button>
            </>
          )}
        </div>
      )}
      {error !== null && (
        <div className="editor-empty-wrap">
          <p className="placeholder">
            {error === 'expired'
              ? t('diff.expired')
              : error === 'binary'
                ? t('diff.binary')
                : t('diff.unavailable')}
          </p>
        </div>
      )}
      <div
        ref={hostRef}
        className="monaco-host diff-host"
        data-testid="diff-host"
        style={{ display: error === null && loaded ? undefined : 'none' }}
      />
      {error === null && !loaded && (
        <div className="editor-empty-wrap">
          <p className="placeholder">{t('diff.loading')}</p>
        </div>
      )}
    </div>
  );
}
