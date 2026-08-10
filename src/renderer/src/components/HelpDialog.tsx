import { useEffect, type ReactElement } from 'react';
import type { StringKey } from '../../../shared/i18n';
import { useT } from '../i18n';

interface HelpDialogProps {
  onClose(): void;
}

/** Sekcje samouczka — tytuł i treść w słowniku i18n (PL/EN). */
const SECTIONS: Array<{ id: string; titleKey: StringKey; bodyKey: StringKey }> = [
  { id: 'start', titleKey: 'help.start.title', bodyKey: 'help.start.body' },
  { id: 'files', titleKey: 'help.files.title', bodyKey: 'help.files.body' },
  { id: 'search', titleKey: 'help.search.title', bodyKey: 'help.search.body' },
  { id: 'git', titleKey: 'help.git.title', bodyKey: 'help.git.body' },
  { id: 'wiedza', titleKey: 'help.wiedza.title', bodyKey: 'help.wiedza.body' },
  { id: 'skills', titleKey: 'help.skills.title', bodyKey: 'help.skills.body' },
  { id: 'mcp', titleKey: 'help.mcp.title', bodyKey: 'help.mcp.body' },
  { id: 'claude', titleKey: 'help.claude.title', bodyKey: 'help.claude.body' },
  { id: 'docks', titleKey: 'help.docks.title', bodyKey: 'help.docks.body' },
];

const SHORTCUTS: Array<{ keys: string; labelKey: StringKey }> = [
  { keys: 'Cmd+B', labelKey: 'help.keys.sidebar' },
  { keys: 'Ctrl+`', labelKey: 'help.keys.bottomDock' },
  { keys: 'Cmd+Shift+C', labelKey: 'help.keys.rightDock' },
  { keys: 'Cmd+P', labelKey: 'help.keys.quickOpen' },
  { keys: 'Cmd+S', labelKey: 'help.keys.save' },
  { keys: 'Cmd+,', labelKey: 'help.keys.settings' },
  { keys: 'Cmd+Shift+L', labelKey: 'help.keys.daily' },
];

/** Samouczek: przewodnik po panelach, dokach i skrótach — przycisk „?". */
export function HelpDialog({ onClose }: HelpDialogProps): ReactElement {
  const t = useT();

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
        className="settings-dialog help-dialog"
        data-testid="help-dialog"
        role="dialog"
        aria-label={t('help.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <h2>{t('help.title')}</h2>
          <button type="button" className="tree-toolbtn" title={t('common.close')} onClick={onClose}>
            ×
          </button>
        </header>
        <p className="help-intro placeholder">{t('help.intro')}</p>
        {SECTIONS.map((section) => (
          <section key={section.id} className="settings-section help-section">
            <h3 className="view-title">{t(section.titleKey)}</h3>
            <p className="help-body">{t(section.bodyKey)}</p>
          </section>
        ))}
        <section className="settings-section help-section">
          <h3 className="view-title">{t('help.keys.title')}</h3>
          <dl className="help-keys">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="help-key-row">
                <dt>
                  <kbd>{shortcut.keys}</kbd>
                </dt>
                <dd>{t(shortcut.labelKey)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
