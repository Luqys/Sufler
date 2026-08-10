import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createTerminalInstance, disposeTerminalInstance } from '../terminals';
import { useWorkspace } from '../workspace';
import { TerminalView } from './TerminalView';

let loginCounter = 0;

/**
 * Widżet logowania do konta Claude: modal z terminalem prowadzącym flow
 * `claude /login` (wybór metody, przeglądarka, kod). Esc obsługuje TUI
 * w terminalu, więc dialog zamyka wyłącznie przycisk ×.
 */
export function LoginDialog({ onClose }: { onClose(): void }): ReactElement {
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
      createTerminalInstance(tabId, result.ptyId);
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
      <div className="login-dialog" data-testid="login-dialog" role="dialog" aria-label="Logowanie do Claude">
        <header className="login-header">
          <span className="login-spark">✳</span>
          <div className="login-titles">
            <h2>Zaloguj się do Claude</h2>
            <p>Konto z subskrypcją (Pro/Max/Team) albo Console — flow `claude /login`.</p>
          </div>
          <button
            type="button"
            className="tree-toolbtn"
            data-testid="login-close"
            title="Zamknij (przerywa logowanie, jeśli trwa)"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="login-terminal">
          {error && <p className="mcp-error">Nie udało się uruchomić `claude`: {error}</p>}
          {!error && !ready && <p className="placeholder login-wait">Uruchamianie logowania…</p>}
          {ready && <TerminalView tabId={tabId} />}
        </div>
        <footer className="login-footer placeholder">
          Metodę wybierasz strzałkami i Enterem · Esc w terminalu anuluje · po „Login successful"
          zamknij okno
        </footer>
      </div>
    </div>
  );
}
