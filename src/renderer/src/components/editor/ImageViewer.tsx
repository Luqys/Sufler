import { useEffect, useState, type ReactElement } from 'react';
import type { ReadImageResult } from '../../../../shared/ipc';
import { baseName } from '../../../../shared/editor/paths';
import { getLocale, t, useT } from '../../i18n';

function describeImageError(error: 'too-large' | 'not-image' | 'unreadable'): string {
  switch (error) {
    case 'too-large':
      return t('image.tooLarge');
    case 'not-image':
      return t('image.notImage');
    case 'unreadable':
      return t('editor.readFailed');
  }
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  const format = (value: number): string =>
    value.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (size < 1024 * 1024) {
    return `${format(size / 1024)} kB`;
  }
  return `${format(size / (1024 * 1024))} MB`;
}

/** Podgląd pliku graficznego w miejscu edytora; „Odśwież" wciąga świeżą wersję z dysku. */
export function ImageViewer({ path }: { path: string }): ReactElement {
  const t = useT();
  const [result, setResult] = useState<ReadImageResult | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setDims(null);
    void window.api.readImage(path).then((data) => {
      if (!cancelled) {
        setResult(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path, reloadNonce]);

  return (
    <div className="image-viewer" data-testid="image-viewer">
      <div className="image-viewer-bar">
        <span className="image-viewer-name">{baseName(path)}</span>
        <span className="image-viewer-meta">
          {dims && `${dims.w} × ${dims.h} px`}
          {dims && result?.ok && ' · '}
          {result?.ok && formatBytes(result.size)}
        </span>
        <button
          type="button"
          className="bar-btn"
          onClick={() => setReloadNonce((nonce) => nonce + 1)}
        >
          {t('common.refresh')}
        </button>
      </div>
      <div className="image-viewer-stage">
        {!result && <p className="placeholder">{t('image.loading')}</p>}
        {result && !result.ok && <p className="placeholder">{describeImageError(result.error)}</p>}
        {result?.ok && (
          <img
            src={result.dataUri}
            alt={baseName(path)}
            onLoad={(event) =>
              setDims({
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              })
            }
          />
        )}
      </div>
    </div>
  );
}
