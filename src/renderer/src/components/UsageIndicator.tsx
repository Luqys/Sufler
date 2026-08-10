import { useEffect, useState, type ReactElement } from 'react';
import type { UsageLimitEntry, UsageLimitsResult } from '../../../shared/limits';

/** Reset dziś → sama godzina; dalej → dzień tygodnia + godzina. */
function resetLabel(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return '';
  }
  const sameDay = when.toDateString() === new Date().toDateString();
  const time = when.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) {
    return time;
  }
  return `${when.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' })}, ${time}`;
}

function LimitBar({ entry }: { entry: UsageLimitEntry }): ReactElement {
  return (
    <div className={`usage-session-bar limit-${entry.severity}`}>
      <i style={{ width: `${entry.percent}%` }} />
    </div>
  );
}

/**
 * Pigułka limitów na pasku tytułu: wyłącznie realne limity planu (sesja 5h
 * i tydzień) z tego samego endpointu, którego używa /usage w Claude Code.
 * Odświeżane co minutę (cache 60 s w main).
 */
export function UsageIndicator(): ReactElement {
  const [open, setOpen] = useState(false);
  const [limits, setLimits] = useState<UsageLimitsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = (force: boolean): void => {
    setLoading(true);
    void window.api.getUsageLimits(force).then((data) => {
      setLimits(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh(false);
    const minute = window.setInterval(() => {
      void window.api.getUsageLimits(false).then(setLimits);
    }, 60_000);
    return () => window.clearInterval(minute);
  }, []);

  const planLimits = limits?.ok ? limits.limits : null;
  const session = planLimits?.session ?? null;
  const weekly = planLimits?.weekly ?? null;

  return (
    <div className="usage-wrap">
      <button
        type="button"
        className="usage-pill"
        data-testid="usage-button"
        title={
          session
            ? `Sesja 5h: ${session.percent}% limitu (reset ${resetLabel(session.resetsAt)})` +
              (weekly ? ` · Tydzień: ${weekly.percent}% (reset ${resetLabel(weekly.resetsAt)})` : '')
            : limits && !limits.ok
              ? `Limity niedostępne: ${limits.error}`
              : 'Limity planu Claude Code'
        }
        onClick={() => setOpen(!open)}
      >
        {session ? (
          <>
            <span className={`usage-pill-bar limit-${session.severity}`} aria-hidden>
              <i style={{ width: `${session.percent}%` }} />
            </span>
            <span className="usage-pill-text" data-testid="usage-limits-text">
              {session.percent}%{weekly && ` · tydz. ${weekly.percent}%`}
            </span>
          </>
        ) : (
          <span className="usage-pill-text">{limits && !limits.ok ? 'limity —' : 'limity…'}</span>
        )}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="usage-panel" data-testid="usage-panel">
            <div className="usage-head">
              <strong>Limity planu Claude</strong>
              <button
                type="button"
                className="bar-btn"
                onClick={() => refresh(true)}
                disabled={loading}
              >
                {loading ? 'Pobieram…' : 'Odśwież'}
              </button>
            </div>
            {!limits && <p className="placeholder">Pobieram limity…</p>}
            {(session || weekly) && (
              <div className="usage-session" data-testid="usage-limits-section">
                {session && (
                  <>
                    <div className="usage-session-row" data-testid="limit-session">
                      <span>Sesja 5h</span>
                      <strong>{session.percent}%</strong>
                    </div>
                    <LimitBar entry={session} />
                    <div className="usage-session-row usage-session-sub">
                      <span>reset {resetLabel(session.resetsAt)}</span>
                    </div>
                  </>
                )}
                {weekly && (
                  <>
                    <div className="usage-session-row" data-testid="limit-weekly">
                      <span>Tydzień (wszystkie modele)</span>
                      <strong>{weekly.percent}%</strong>
                    </div>
                    <LimitBar entry={weekly} />
                    <div className="usage-session-row usage-session-sub">
                      <span>reset {resetLabel(weekly.resetsAt)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {limits && !limits.ok && (
              <p className="usage-note placeholder">Limity planu: {limits.error}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
