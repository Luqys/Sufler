import { useEffect, useRef, useState, type ReactElement } from 'react';
import { tf, useT } from '../../i18n';
import { createTerminalInstance, disposeTerminalInstance } from '../../terminals';
import { useWorkspace } from '../../workspace';
import { TerminalView } from '../dock/TerminalView';

let loginCounter = 0;

/**
 * Widżet logowania do konta Claude: modal z terminalem prowadzącym flow
 * `claude /login` (wybór metody, przeglądarka, kod). Esc obsługuje TUI
 * w terminalu, więc dialog zamyka wyłącznie przycisk ×.
 */
export function LoginDialog({ onClose }: { onClose(): void }): ReactElement {
  const t = useT();
  const { root } = useWorkspace();
  const [tabId] = useState(() => `login-widget-${++loginCounter}`);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ptyIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api.ptyCreate({ kind: 'claude', cwd: root, args: ['/login'] }).then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (cancelled) {
        void window.api.ptyKill(result.ptyId);
        return;
      }
      ptyIdRef.current = result.ptyId;
      createTerminalInstance(tabId, result.ptyId, { kind: 'claude' });
      setReady(true);
    });
    return () => {
      cancelled = true;
      if (ptyIdRef.current !== null) {
        void window.api.ptyKill(ptyIdRef.current);
        ptyIdRef.current = null;
      }
      disposeTerminalInstance(tabId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jednorazowy cykl życia widżetu
  }, []);

  return (
    <div className="settings-overlay">
      <div className="login-dialog" data-testid="login-dialog" role="dialog" aria-label={t('login.aria')}>
        <header className="login-header">
          <span className="login-spark">✳</span>
          <div className="login-titles">
            <h2>{t('login.title')}</h2>
            <p>{t('login.sub')}</p>
          </div>
          <button
            type="button"
            className="tree-toolbtn"
            data-testid="login-close"
            title={t('login.closeTitle')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="login-terminal">
          {error && <p className="mcp-error">{tf('login.startFailed', { error })}</p>}
          {!error && !ready && <p className="placeholder login-wait">{t('login.starting')}</p>}
          {ready && <TerminalView tabId={tabId} />}
        </div>
        <footer className="login-footer placeholder">{t('login.footer')}</footer>
      </div>
    </div>
  );
}
