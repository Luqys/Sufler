import { useEffect, useState, type ReactElement } from 'react';
import { createTerminalInstance } from '../terminals';
import { TerminalView } from './TerminalView';

/**
 * Zawartość odczepionego okna terminala (?window=terminal&ptyId=N):
 * ten sam proces pty, scrollback odtworzony z serializacji.
 */
export function DetachedTerminal(): ReactElement {
  const [tabId, setTabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ptyId = Number(new URLSearchParams(location.search).get('ptyId'));
    if (!Number.isFinite(ptyId) || ptyId <= 0) {
      setError('Brak identyfikatora sesji.');
      return;
    }
    void window.api.getDetachedInfo(ptyId).then((info) => {
      if (!info) {
        setError('Sesja nie istnieje (mogła zostać zamknięta).');
        return;
      }
      document.title = `${info.title} — VisualN3O`;
      const id = `detached-${ptyId}`;
      const instance = createTerminalInstance(id, ptyId);
      if (info.serialized) {
        instance.term.write(info.serialized);
      }
      setTabId(id);
    });
  }, []);

  return (
    <div className="detached-shell" data-testid="detached-terminal">
      {error && <p className="placeholder detached-error">{error}</p>}
      {tabId && <TerminalView tabId={tabId} />}
    </div>
  );
}
