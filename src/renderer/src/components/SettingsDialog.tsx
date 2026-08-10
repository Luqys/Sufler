import { useEffect, type ReactElement } from 'react';
import { useWorkspace } from '../workspace';

interface SettingsDialogProps {
  onClose(): void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps): ReactElement {
  const { root, vault, chooseProject, chooseVault, clearVault } = useWorkspace();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-dialog"
        data-testid="settings-dialog"
        role="dialog"
        aria-label="Ustawienia"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <h2>Ustawienia</h2>
          <button type="button" className="tree-toolbtn" title="Zamknij" onClick={onClose}>
            ×
          </button>
        </header>
        <section className="settings-section">
          <h3 className="view-title">Projekt</h3>
          <p className="settings-path" title={root}>
            {root}
          </p>
          <button type="button" className="bar-btn" onClick={chooseProject}>
            Zmień folder projektu…
          </button>
        </section>
        <section className="settings-section">
          <h3 className="view-title">Vault Obsidiana</h3>
          <p className="settings-path" title={vault ?? undefined}>
            {vault ?? '(nie skonfigurowano)'}
          </p>
          <div className="settings-actions">
            <button type="button" className="bar-btn" onClick={chooseVault}>
              {vault ? 'Zmień vault…' : 'Wybierz vault…'}
            </button>
            {vault && (
              <button type="button" className="bar-btn" onClick={clearVault}>
                Odepnij
              </button>
            )}
          </div>
        </section>
        <section className="settings-section">
          <h3 className="view-title">Konfiguracja</h3>
          <p className="settings-path">
            Układ i stan aplikacji: ~/.config/visualn3o/ (layout.json, state.json)
          </p>
        </section>
      </div>
    </div>
  );
}
