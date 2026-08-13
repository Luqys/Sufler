import { type ReactElement } from 'react';
import type { StringKey } from '../../../../shared/i18n';
import { useT } from '../../i18n';

/** Sekcje samouczka — tytuł i treść w słowniku i18n (PL/EN). */
const SECTIONS: Array<{ id: string; titleKey: StringKey; bodyKey: StringKey }> = [
  { id: 'start', titleKey: 'help.start.title', bodyKey: 'help.start.body' },
  { id: 'files', titleKey: 'help.files.title', bodyKey: 'help.files.body' },
  { id: 'search', titleKey: 'help.search.title', bodyKey: 'help.search.body' },
  { id: 'git', titleKey: 'help.git.title', bodyKey: 'help.git.body' },
  { id: 'kontekst', titleKey: 'help.kontekst.title', bodyKey: 'help.kontekst.body' },
  { id: 'ratunek', titleKey: 'help.ratunek.title', bodyKey: 'help.ratunek.body' },
  { id: 'historia', titleKey: 'help.historia.title', bodyKey: 'help.historia.body' },
  { id: 'limity', titleKey: 'help.limity.title', bodyKey: 'help.limity.body' },
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

/** Samouczek jako karta w obszarze edytora (M47) — przewodnik po aplikacji. */
export function HelpView(): ReactElement {
  const t = useT();

  return (
    (
      <div className="settings-page help-page" data-testid="help-view">
        <h2 className="settings-page-title">{t('help.title')}</h2>
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
    )
  );
}
