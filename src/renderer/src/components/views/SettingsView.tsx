import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  ACCENTS,
  DEFAULT_APPEARANCE,
  LANGUAGES,
  THEME_MODES,
  type Appearance,
} from '../../../../shared/project/appearance';
import {
  HOOK_EVENTS,
  supportsMatcher,
  type HookEvent,
} from '../../../../shared/skills/hooks-config';
import type { HookListEntry } from '../../../../shared/ipc';
import { applyAppearance } from '../../appearance-client';
import { useT } from '../../i18n';
import { useDialogs } from '../../ui-dialogs';
import { useWorkspace } from '../../workspace';

/** Ustawienia jako karta w obszarze edytora (M47) — bez modala. */
export function SettingsView(): ReactElement {
  const { root, chooseProject } = useWorkspace();
  const t = useT();
  const [appearance, setAppearanceState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [sessionLog, setSessionLog] = useState(true);
  const [globalLog, setGlobalLog] = useState(false);
  const [hooks, setHooks] = useState<HookListEntry[]>([]);
  /** „Sprawdzaj po zapisie" (M90) — od M95 mieszka tu, bo to ustawienie trwałe. */
  const [diagAuto, setDiagAuto] = useState(false);
  /** Pytanie przed zamknięciem karty z procesem (M99) — tu wraca po „nie pytaj więcej". */
  const [confirmClose, setConfirmClose] = useState(true);
  const [hookEvent, setHookEvent] = useState<HookEvent>('PreToolUse');
  const [hookMatcher, setHookMatcher] = useState('');
  const [hookCommand, setHookCommand] = useState('');
  const { notify } = useDialogs();

  const refreshHooks = useCallback(() => {
    void window.api.listHooks(root).then(setHooks);
  }, [root]);

  useEffect(() => {
    void window.api.getAppearance().then(setAppearanceState);
    void window.api.getSessionLogEnabled().then(setSessionLog);
    void window.api.getGlobalSessionLog().then(setGlobalLog);
    void window.api.getDiagnosticsAuto().then(setDiagAuto);
    void window.api.getConfirmCloseTab().then(setConfirmClose);
  }, []);

  useEffect(refreshHooks, [refreshHooks]);

  const addHook = (): void => {
    const command = hookCommand.trim();
    if (command === '') {
      return;
    }
    const matcher = supportsMatcher(hookEvent) ? hookMatcher.trim() : '';
    void window.api.addHook(root, { event: hookEvent, matcher, command }).then((result) => {
      if (result.ok) {
        setHookCommand('');
        setHookMatcher('');
      } else {
        notify(t('settings.hooksFailed'), 'error');
      }
      refreshHooks();
    });
  };

  const removeHook = (entry: HookListEntry): void => {
    void window.api
      .removeHook(root, entry.layer, {
        event: entry.event,
        matcher: entry.matcher,
        command: entry.command,
      })
      .then((result) => {
        if (!result.ok) {
          notify(t('settings.hooksFailed'), 'error');
        }
        refreshHooks();
      });
  };

  const updateAppearance = (patch: Partial<Appearance>): void => {
    const next = { ...appearance, ...patch };
    setAppearanceState(next);
    applyAppearance(next);
    void window.api.setAppearance(next);
  };

  return (
    <div className="settings-page" data-testid="settings-view">
      <header className="settings-page-head">
        <h2 className="settings-page-title">{t('settings.title')}</h2>
        <p className="settings-page-sub">{t('settings.subtitle')}</p>
      </header>
      <section className="settings-section">
        <h3 className="view-title">{t('settings.appearance')}</h3>
        <p className="settings-hint">{t('settings.appearanceHint')}</p>
        <div className="segmented" role="radiogroup" aria-label={t('settings.themeAria')}>
          {THEME_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`segmented-btn${appearance.mode === mode.id ? ' active' : ''}`}
              data-testid={`theme-${mode.id}`}
              aria-pressed={appearance.mode === mode.id}
              onClick={() => updateAppearance({ mode: mode.id })}
            >
              {t(`theme.${mode.id}`)}
            </button>
          ))}
        </div>
        <div className="settings-swatches" role="radiogroup" aria-label={t('settings.accentAria')}>
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
        <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className={`segmented-btn${appearance.language === lang.id ? ' active' : ''}`}
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
        <p className="settings-mono" title={root}>
          {root}
        </p>
        <div className="settings-actions">
          <button type="button" className="settings-btn" onClick={chooseProject}>
            {t('settings.changeProject')}
          </button>
        </div>
      </section>
      <section className="settings-section">
        <h3 className="view-title">{t('settings.sessionLog')}</h3>
        <p className="settings-hint">{t('settings.sessionLogHint')}</p>
        <label className="settings-switch">
          <input
            type="checkbox"
            role="switch"
            data-testid="session-log-toggle"
            checked={sessionLog}
            onChange={(event) => {
              const next = event.target.checked;
              setSessionLog(next);
              void window.api.setSessionLogEnabled(next);
            }}
          />
          <span>{t('settings.sessionLogSwitch')}</span>
        </label>
        <label className="settings-switch">
          <input
            type="checkbox"
            role="switch"
            data-testid="session-log-global-toggle"
            checked={globalLog}
            onChange={(event) => {
              const next = event.target.checked;
              setGlobalLog(next);
              void window.api.setGlobalSessionLog(next).then((result) => {
                if (!result.ok) {
                  setGlobalLog(!next);
                }
              });
            }}
          />
          <span>{t('settings.sessionLogGlobal')}</span>
        </label>
        <p className="settings-hint">{t('settings.sessionLogGlobalHint')}</p>
      </section>
      <section className="settings-section" data-testid="diagnostics-section">
        <h3 className="view-title">{t('settings.diagnostics')}</h3>
        <p className="settings-hint">{t('settings.diagnosticsHint')}</p>
        <label className="settings-switch">
          <input
            type="checkbox"
            role="switch"
            data-testid="diagnostics-auto"
            checked={diagAuto}
            onChange={(event) => {
              const next = event.target.checked;
              setDiagAuto(next);
              void window.api.setDiagnosticsAuto(next);
            }}
          />
          <span>{t('settings.diagnosticsAuto')}</span>
        </label>
      </section>
      <section className="settings-section" data-testid="tabs-section">
        <h3 className="view-title">{t('settings.tabs')}</h3>
        <p className="settings-hint">{t('settings.tabsHint')}</p>
        <label className="settings-switch">
          <input
            type="checkbox"
            role="switch"
            data-testid="confirm-close-tab"
            checked={confirmClose}
            onChange={(event) => {
              const next = event.target.checked;
              setConfirmClose(next);
              void window.api.setConfirmCloseTab(next);
            }}
          />
          <span>{t('settings.confirmCloseTab')}</span>
        </label>
      </section>
      <section className="settings-section" data-testid="hooks-section">
        <h3 className="view-title">{t('settings.hooks')}</h3>
        <p className="settings-hint">{t('settings.hooksHint')}</p>
        {hooks.length === 0 && <p className="settings-hint">{t('settings.hooksEmpty')}</p>}
        {hooks.map((entry) => (
          <div
            key={`${entry.layer}:${entry.event}:${entry.matcher}:${entry.command}`}
            className="hook-row"
            data-testid="hook-row"
          >
            <span className="hook-event">{entry.event}</span>
            {entry.matcher !== '' && <span className="badge">{entry.matcher}</span>}
            <span className="hook-command settings-mono" title={entry.command}>
              {entry.command}
            </span>
            <span className="badge hook-layer">{t(`settings.hookLayer.${entry.layer}`)}</span>
            {entry.managed ? (
              <span className="badge" title={t('settings.hookManagedHint')}>
                Sufler
              </span>
            ) : (
              <button
                type="button"
                className="settings-btn"
                data-testid="hook-remove"
                onClick={() => removeHook(entry)}
              >
                {t('settings.hookRemove')}
              </button>
            )}
          </div>
        ))}
        <div className="settings-fields hook-form">
          <label className="settings-field">
            <span>{t('settings.hookEvent')}</span>
            <select
              data-testid="hook-event"
              value={hookEvent}
              onChange={(event) => setHookEvent(event.target.value as HookEvent)}
            >
              {HOOK_EVENTS.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </label>
          {supportsMatcher(hookEvent) && (
            <label className="settings-field">
              <span>{t('settings.hookMatcher')}</span>
              <input
                type="text"
                data-testid="hook-matcher"
                placeholder="Bash|Edit"
                value={hookMatcher}
                onChange={(event) => setHookMatcher(event.target.value)}
              />
            </label>
          )}
          <label className="settings-field">
            <span>{t('settings.hookCommand')}</span>
            <input
              type="text"
              data-testid="hook-command"
              placeholder="say gotowe"
              value={hookCommand}
              onChange={(event) => setHookCommand(event.target.value)}
            />
          </label>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn"
            data-testid="hook-add"
            disabled={hookCommand.trim() === ''}
            onClick={addHook}
          >
            {t('settings.hookAdd')}
          </button>
        </div>
        <p className="settings-hint">{t('settings.hooksWriteHint')}</p>
      </section>
      <section className="settings-section">
        <h3 className="view-title">{t('settings.config')}</h3>
        <p className="settings-mono">{t('settings.configPath')}</p>
      </section>
    </div>
  );
}
