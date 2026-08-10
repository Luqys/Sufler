import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { formatElementReference, normalizeUrl, type PickedElement } from '../../../shared/preview';
import { useDocks } from '../docks';
import { t as tNow, useT } from '../i18n';
import { useDialogs } from '../ui-dialogs';

/** Minimalny interfejs elementu <webview> (bez typów electrona w rendererze). */
interface WebviewElement extends HTMLElement {
  send(channel: string, ...args: unknown[]): void;
  reload(): void;
  getURL(): string;
}

interface WebviewIpcMessageEvent extends Event {
  channel: string;
  args: unknown[];
}

/** Adres przeżywa zamknięcie i ponowne otwarcie zakładki podglądu. */
let lastUrl = 'http://localhost:3000';

export function BrowserPreview(): ReactElement {
  const t = useT();
  const { insertToActiveClaude } = useDocks();
  const { notify } = useDialogs();
  const [address, setAddress] = useState(lastUrl);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [preloadPath, setPreloadPath] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const webviewRef = useRef<WebviewElement | null>(null);

  useEffect(() => {
    void window.api.getWebviewPreloadPath().then(setPreloadPath);
  }, []);

  const handlePicked = useCallback(
    (picked: PickedElement) => {
      setPicking(false);
      const reference = formatElementReference(picked);
      if (!insertToActiveClaude(reference)) {
        void navigator.clipboard.writeText(reference);
        // Moduł i18n czyta język w momencie zdarzenia — bez zależności od t z useT().
        notify(tNow('preview.copied'), 'info');
      }
    },
    [insertToActiveClaude, notify],
  );

  const attachWebview = useCallback(
    (node: HTMLElement | null) => {
      webviewRef.current = node as WebviewElement | null;
      if (!node) {
        return;
      }
      node.addEventListener('ipc-message', (event) => {
        const message = event as WebviewIpcMessageEvent;
        if (message.channel === 'vn3o:picked') {
          handlePicked(message.args[0] as PickedElement);
        } else if (message.channel === 'vn3o:pick-cancelled') {
          setPicking(false);
        }
      });
      node.addEventListener('did-navigate', () => {
        const url = (node as WebviewElement).getURL();
        if (url) {
          lastUrl = url;
          setAddress(url);
        }
      });
    },
    [handlePicked],
  );

  const load = (): void => {
    const url = normalizeUrl(address);
    if (url === '') {
      return;
    }
    lastUrl = url;
    setAddress(url);
    setCurrentUrl(url);
    setPicking(false);
  };

  const togglePick = (): void => {
    const webview = webviewRef.current;
    if (!webview || !currentUrl) {
      return;
    }
    if (picking) {
      webview.send('vn3o:stop-pick');
      setPicking(false);
    } else {
      webview.send('vn3o:start-pick');
      setPicking(true);
    }
  };

  return (
    <div className="browser-preview" data-testid="browser-preview">
      <div className="preview-toolbar">
        <input
          type="text"
          className="preview-address"
          data-testid="preview-address"
          value={address}
          placeholder="http://localhost:3000"
          spellCheck={false}
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              load();
            }
          }}
        />
        <button type="button" className="bar-btn" data-testid="preview-go" onClick={load}>
          {t('preview.go')}
        </button>
        <button
          type="button"
          className="bar-btn"
          title={t('preview.reload')}
          onClick={() => webviewRef.current?.reload()}
          disabled={!currentUrl}
        >
          ⟳
        </button>
        <button
          type="button"
          className={`bar-btn${picking ? ' active' : ''}`}
          data-testid="preview-pick"
          title={t('preview.pickTitle')}
          onClick={togglePick}
          disabled={!currentUrl}
        >
          {picking ? t('preview.picking') : t('preview.pick')}
        </button>
      </div>
      {currentUrl && preloadPath ? (
        <webview
          ref={attachWebview}
          className="preview-webview"
          src={currentUrl}
          preload={preloadPath}
        />
      ) : (
        <div className="editor-empty-wrap">
          <div className="editor-empty">
            <p className="placeholder">{t('preview.empty')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
