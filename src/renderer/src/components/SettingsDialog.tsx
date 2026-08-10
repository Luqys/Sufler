import { useEffect, useState, type ReactElement } from 'react';
import {
  ACCENTS,
  DEFAULT_APPEARANCE,
  THEME_MODES,
  type Appearance,
} from '../../../shared/appearance';
import { applyAppearance } from '../appearance-client';
import { useWorkspace } from '../workspace';

interface SettingsDialogProps {
  onClose(): void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps): ReactElement {
  const { root, vault, chooseProject, chooseVault, clearVault } = useWorkspace();
  const [appearance, setAppearanceState] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    void window.api.getAppearance().then(setAppearanceState);
  }, []);

  const updateAppearance = (patch: Partial<Appearance>): void => {
    const next = { ...appearance, ...patch };
    setAppearanceState(next);
    applyAppearance(next);
    void window.api.setAppearance(next);
  };

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
          <h3 className="view-title">Wygląd</h3>
          <div className="settings-actions" role="radiogroup" aria-label="Motyw">
            {THEME_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`bar-btn${appearance.mode === mode.id ? ' active' : ''}`}
                data-testid={`theme-${mode.id}`}
                aria-pressed={appearance.mode === mode.id}
                onClick={() => updateAppearance({ mode: mode.id })}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="settings-actions" role="radiogroup" aria-label="Kolor przewodni">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                className={`accent-swatch${appearance.accent === accent.id ? ' active' : ''}`}
                data-testid={`accent-${accent.id}`}
                title={accent.label}
                aria-pressed={appearance.accent === accent.id}
                style={{ background: accent.swatch }}
                onClick={() => updateAppearance({ accent: accent.id })}
              />
            ))}
          </div>
        </section>
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
            Układ i stan aplikacji: ~/.config/neodesk/ (layout.json, state.json)
          </p>
        </section>
      </div>
    </div>
  );
}
