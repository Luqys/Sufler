import { useEffect, useState, type ReactElement } from 'react';
import { groupByDay, type WorklogEntry } from '../../../shared/worklog';
import { getLocale, tf, useT } from '../i18n';
import { useWorkspace } from '../workspace';

/** Historia pracy (M56): commity i dzienniki sesji na wspólnej osi czasu. */
export function WorklogView(): ReactElement {
  const t = useT();
  const { root, openFile } = useWorkspace();
  const [entries, setEntries] = useState<WorklogEntry[] | null>(null);

  useEffect(() => {
    void window.api.getWorklog(root).then(setEntries);
  }, [root]);

  const groups = groupByDay(entries ?? []);

  return (
    <div className="settings-page worklog-page" data-testid="worklog-view">
      <header className="settings-page-head">
        <h2 className="settings-page-title">{t('worklog.title')}</h2>
        <p className="settings-page-sub">{t('worklog.subtitle')}</p>
      </header>
      {entries !== null && entries.length === 0 && (
        <section className="settings-section">
          <p className="settings-hint">{t('worklog.empty')}</p>
        </section>
      )}
      {groups.map(([day, items]) => (
        <section key={day} className="settings-section worklog-day">
          <h3 className="view-title">
            {new Date(`${day}T12:00:00`).toLocaleDateString(getLocale(), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>
          <div className="worklog-items">
            {items.map((entry) => (
              <div
                key={`${entry.kind}-${entry.reference}-${entry.date}`}
                className={`worklog-row worklog-${entry.kind}`}
                data-testid="worklog-row"
              >
                <span className="worklog-time">
                  {Number.isNaN(Date.parse(entry.date))
                    ? '—'
                    : new Date(entry.date).toLocaleTimeString(getLocale(), {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </span>
                <span className={`worklog-kind worklog-kind-${entry.kind}`}>
                  {t(entry.kind === 'commit' ? 'worklog.commit' : 'worklog.session')}
                </span>
                {entry.kind === 'session' ? (
                  <button
                    type="button"
                    className="worklog-title worklog-link"
                    title={entry.reference}
                    onClick={() => openFile(`${root}/${entry.reference}`)}
                  >
                    {entry.title}
                  </button>
                ) : (
                  <span className="worklog-title" title={entry.reference}>
                    {entry.title}
                  </span>
                )}
                <span className="worklog-detail">
                  {entry.kind === 'commit'
                    ? entry.detail
                    : tf('worklog.operations', { n: entry.detail })}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
