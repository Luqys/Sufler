import { useEffect, useState, type ReactElement } from 'react';
import { applyAppearance } from '../appearance-client';
import { t } from '../i18n';
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
    // Osobne okno nie przechodzi przez App — akcent i smak motywu ustawiamy tu.
    void window.api.getAppearance().then(applyAppearance);
    const ptyId = Number(new URLSearchParams(location.search).get('ptyId'));
    if (!Number.isFinite(ptyId) || ptyId <= 0) {
      setError(t('detached.noSession'));
      return;
    }
    void window.api.getDetachedInfo(ptyId).then((info) => {
      if (!info) {
        setError(t('detached.gone'));
        return;
      }
      document.title = `${info.title} — Neodesk`;
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
