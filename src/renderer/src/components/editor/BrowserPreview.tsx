import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { formatElementReference, normalizeUrl, type PickedElement } from '../../../../shared/editor/preview';
import { useDocks } from '../../docks';
import { t as tNow, useT } from '../../i18n';
import { useDialogs } from '../../ui-dialogs';

/** Minimalny interfejs elementu <webview> (bez typów electrona w rendererze). */
interface WebviewElement extends HTMLElement {
  send(channel: string, ...args: unknown[]): void;
  reload(): void;
  getURL(): string;
  /**
   * Historia przeglądania idzie przez offsety, a nie przez `goBack()`/
   * `canGoBack()`: te w Electronie 43 są na <webview> martwe — zostały po
   * usuniętych metodach WebContents, nie rzucają, po prostu nic nie robią
   * (`canGoBack()` zawsze false, `goBack()` bez efektu). `goToOffset` działa.
   */
  canGoToOffset(offset: number): boolean;
  goToOffset(offset: number): void;
}

interface WebviewIpcMessageEvent extends Event {
  channel: string;
  args: unknown[];
}

const DEFAULT_URL = 'http://localhost:3000';

/**
 * Adres przeżywa zamknięcie i ponowne otwarcie zakładki podglądu — osobno
 * dla każdej karty, bo podglądów może być kilka (np. localhost:3000 obok
 * localhost:5173).
 */
const lastUrls = new Map<string, string>();

export function BrowserPreview({ path }: { path: string }): ReactElement {
  const t = useT();
  const { insertToActiveClaude } = useDocks();
  const { notify } = useDialogs();
  const [address, setAddress] = useState(lastUrls.get(path) ?? DEFAULT_URL);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [preloadPath, setPreloadPath] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
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

  /**
   * Stan strzałek czytamy z historii gościa po każdej nawigacji. `canGoBack`
   * rzuca, dopóki webview nie jest podpięty do DOM-u i gotowy — stąd try.
   */
  const syncHistory = useCallback((node: WebviewElement) => {
    try {
      setCanBack(node.canGoToOffset(-1));
      setCanForward(node.canGoToOffset(1));
    } catch {
      setCanBack(false);
      setCanForward(false);
    }
  }, []);

  const navigate = useCallback((offset: number) => {
    const webview = webviewRef.current;
    if (webview?.canGoToOffset(offset)) {
      webview.goToOffset(offset);
    }
  }, []);

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
        } else if (message.channel === 'vn3o:nav') {
          // Alt+strzałka wciśnięta wewnątrz strony — klawiatura gościa
          // nie dociera do hosta, więc skrót wraca przez IPC (preload).
          navigate(message.args[0] === 1 ? 1 : -1);
        }
      });
      const onNavigated = (): void => {
        const webview = node as WebviewElement;
        const url = webview.getURL();
        if (url) {
          lastUrls.set(path, url);
          setAddress(url);
        }
        syncHistory(webview);
      };
      node.addEventListener('did-navigate', onNavigated);
      // Nawigacja bez przeładowania (pushState, kotwice) — SPA to codzienność.
      node.addEventListener('did-navigate-in-page', onNavigated);
      node.addEventListener('dom-ready', () => syncHistory(node as WebviewElement));
    },
    [handlePicked, navigate, path, syncHistory],
  );

  const load = (): void => {
    const url = normalizeUrl(address);
    if (url === '') {
      return;
    }
    lastUrls.set(path, url);
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
        <button
          type="button"
          className="bar-btn preview-nav"
          data-testid="preview-back"
          title={t('preview.back')}
          aria-label={t('preview.back')}
          onClick={() => navigate(-1)}
          disabled={!canBack}
        >
          ←
        </button>
        <button
          type="button"
          className="bar-btn preview-nav"
          data-testid="preview-forward"
          title={t('preview.forward')}
          aria-label={t('preview.forward')}
          onClick={() => navigate(1)}
          disabled={!canForward}
        >
          →
        </button>
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
