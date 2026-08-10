import { useEffect, useState, type ReactElement } from 'react';
import {
  ACCENTS,
  DEFAULT_APPEARANCE,
  LANGUAGES,
  THEME_MODES,
  type Appearance,
} from '../../../shared/appearance';
import type { ObsidianRestConfig } from '../../../shared/obsidian-rest';
import { applyAppearance } from '../appearance-client';
import { useT } from '../i18n';
import { useWorkspace } from '../workspace';

interface SettingsDialogProps {
  onClose(): void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps): ReactElement {
  const { root, vault, chooseProject, chooseVault, clearVault } = useWorkspace();
  const t = useT();
  const [appearance, setAppearanceState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [obsidian, setObsidian] = useState<ObsidianRestConfig>({});

  useEffect(() => {
    void window.api.getAppearance().then(setAppearanceState);
    void window.api.getObsidianConfig().then(setObsidian);
  }, []);

  const updateObsidian = (patch: Partial<ObsidianRestConfig>): void => {
    setObsidian((current) => ({ ...current, ...patch }));
  };
  const saveObsidian = (): void => {
    void window.api.setObsidianConfig(obsidian);
  };

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
        aria-label={t('settings.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <h2>{t('settings.title')}</h2>
          <button type="button" className="tree-toolbtn" title={t('common.close')} onClick={onClose}>
            ×
          </button>
        </header>
        <section className="settings-section">
          <h3 className="view-title">{t('settings.appearance')}</h3>
          <div className="settings-actions" role="radiogroup" aria-label={t('settings.themeAria')}>
            {THEME_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`bar-btn${appearance.mode === mode.id ? ' active' : ''}`}
                data-testid={`theme-${mode.id}`}
                aria-pressed={appearance.mode === mode.id}
                onClick={() => updateAppearance({ mode: mode.id })}
              >
                {t(`theme.${mode.id}`)}
              </button>
            ))}
          </div>
          <div className="settings-actions" role="radiogroup" aria-label={t('settings.accentAria')}>
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                className={`accent-swatch${appearance.accent === accent.id ? ' active' : ''}`}
                data-testid={`accent-${accent.id}`}
                title={t(`accent.${accent.id}`)}
                aria-pressed={appearance.accent === accent.id}
                style={{ background: accent.swatch }}
                onClick={() => updateAppearance({ accent: accent.id })}
              />
            ))}
          </div>
        </section>
        <section className="settings-section">
          <h3 className="view-title">{t('settings.language')}</h3>
          <div className="settings-actions" role="radiogroup" aria-label={t('settings.language')}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                className={`bar-btn${appearance.language === lang.id ? ' active' : ''}`}
                data-testid={`language-${lang.id}`}
                aria-pressed={appearance.language === lang.id}
                onClick={() => updateAppearance({ language: lang.id })}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </section>
        <section className="settings-section">
          <h3 className="view-title">{t('settings.project')}</h3>
          <p className="settings-path" title={root}>
            {root}
          </p>
          <button type="button" className="bar-btn" onClick={chooseProject}>
            {t('settings.changeProject')}
          </button>
        </section>
        <section className="settings-section">
          <h3 className="view-title">{t('settings.vault')}</h3>
          <p className="settings-path" title={vault ?? undefined}>
            {vault ?? t('settings.vaultNone')}
          </p>
          <div className="settings-actions">
            <button type="button" className="bar-btn" onClick={chooseVault}>
              {vault ? t('settings.vaultChange') : t('settings.vaultPick')}
            </button>
            {vault && (
              <button type="button" className="bar-btn" onClick={clearVault}>
                {t('settings.vaultClear')}
              </button>
            )}
          </div>
        </section>
        <section className="settings-section">
          <h3 className="view-title">{t('settings.obsidianTitle')}</h3>
          <div className="settings-fields">
            <label className="settings-field">
              <span>{t('settings.obsidianApiKey')}</span>
              <input
                type="password"
                data-testid="obsidian-api-key"
                value={obsidian.apiKey ?? ''}
                onChange={(event) => updateObsidian({ apiKey: event.target.value })}
                onBlur={saveObsidian}
              />
            </label>
            <label className="settings-field">
              <span>{t('settings.obsidianUrl')}</span>
              <input
                type="text"
                data-testid="obsidian-url"
                placeholder="http://127.0.0.1:27123"
                value={obsidian.url ?? ''}
                onChange={(event) => updateObsidian({ url: event.target.value })}
                onBlur={saveObsidian}
              />
            </label>
            <label className="settings-field">
              <span>{t('settings.obsidianDailyFile')}</span>
              <input
                type="text"
                data-testid="obsidian-daily-file"
                placeholder="Dziennik/{date}.md"
                value={obsidian.dailyFile ?? ''}
                onChange={(event) => updateObsidian({ dailyFile: event.target.value })}
                onBlur={saveObsidian}
              />
            </label>
            <label className="settings-field">
              <span>{t('settings.obsidianDailyHeading')}</span>
              <input
                type="text"
                data-testid="obsidian-daily-heading"
                value={obsidian.dailyHeading ?? ''}
                onChange={(event) => updateObsidian({ dailyHeading: event.target.value })}
                onBlur={saveObsidian}
              />
            </label>
          </div>
          <p className="settings-path">{t('settings.obsidianHint')}</p>
        </section>
        <section className="settings-section">
          <h3 className="view-title">{t('settings.config')}</h3>
          <p className="settings-path">{t('settings.configPath')}</p>
        </section>
      </div>
    </div>
  );
}
