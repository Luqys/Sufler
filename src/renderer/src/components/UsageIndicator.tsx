import { useEffect, useState, type ReactElement } from 'react';
import type { UsageLimitEntry, UsageLimitsResult } from '../../../shared/limits';
import { formatTokens, type UsageSummary } from '../../../shared/usage';

function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

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
 * Pigułka sesji na pasku tytułu: postęp czasowy bieżącego okna 5h, godzina
 * resetu i tokeny tego okna. Liczone lokalnie z transkryptów; pasek tyka
 * co minutę, skan odświeża się co 5 minut.
 */
export function UsageIndicator(): ReactElement {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [limits, setLimits] = useState<UsageLimitsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);

  const refresh = (force: boolean): void => {
    setLoading(true);
    void window.api.getUsage(force).then((data) => {
      setSummary(data);
      setLoading(false);
    });
    void window.api.getUsageLimits(force).then(setLimits);
  };

  useEffect(() => {
    refresh(false);
    // Tykanie paska czasu + limity co minutę (cache 60 s w main), skan co 5 min.
    const minute = window.setInterval(() => {
      setTick((value) => value + 1);
      void window.api.getUsageLimits(false).then(setLimits);
    }, 60_000);
    const rescan = window.setInterval(() => refresh(false), 5 * 60_000);
    return () => {
      window.clearInterval(minute);
      window.clearInterval(rescan);
    };
  }, []);

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (next && !summary) {
      refresh(false);
    }
  };

  const block = summary?.block ?? null;
  const now = Date.now();
  const timePercent = block
    ? Math.min(
        100,
        Math.max(0, Math.round(((now - block.windowStart) / (block.windowEnd - block.windowStart)) * 100)),
      )
    : 0;
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
            : block
              ? `Okno 5h: ${clockTime(block.windowStart)}–${clockTime(block.windowEnd)} · ` +
                `zużyte ${formatTokens(block.currentTokens)} tokenów`
              : 'Zużycie Claude Code'
        }
        onClick={toggle}
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
        ) : block ? (
          <>
            <span className="usage-pill-bar" aria-hidden>
              <i style={{ width: `${timePercent}%` }} />
            </span>
            <span className="usage-pill-text" data-testid="usage-window-tokens">
              {formatTokens(block.currentTokens)} · do {clockTime(block.windowEnd)}
            </span>
          </>
        ) : (
          <span className="usage-pill-text">sesja…</span>
        )}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="usage-panel" data-testid="usage-panel">
            <div className="usage-head">
              <strong>Zużycie Claude</strong>
              <button
                type="button"
                className="bar-btn"
                onClick={() => refresh(true)}
                disabled={loading}
              >
                {loading ? 'Liczę…' : 'Odśwież'}
              </button>
            </div>
            {!summary && loading && <p className="placeholder">Skanuję transkrypty…</p>}
            {planLimits && (session || weekly) && (
              <div className="usage-session" data-testid="usage-limits-section">
                <div className="usage-session-row">
                  <span>Limity planu (jak w Claude Code)</span>
                </div>
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
            {summary && (
              <>
                <div className="usage-session">
                  <div className="usage-session-row">
                    <span>
                      Okno 5h: {clockTime(summary.block.windowStart)}–
                      {clockTime(summary.block.windowEnd)}
                    </span>
                    <strong>{formatTokens(summary.block.currentTokens)} tok.</strong>
                  </div>
                  <div className="usage-session-bar">
                    <i style={{ width: `${timePercent}%` }} />
                  </div>
                  <div className="usage-session-row usage-session-sub">
                    <span>reset o {clockTime(summary.block.windowEnd)}</span>
                    {summary.block.percent !== null && (
                      <span>
                        {summary.block.percent}% rekordu 30 dni (
                        {formatTokens(summary.block.maxTokens)})
                      </span>
                    )}
                  </div>
                </div>
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Odpowiedzi</th>
                      <th>Wyjście</th>
                      <th>Cache (odczyt)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.periods.map((period) => (
                      <tr key={period.label}>
                        <td className="usage-label">{period.label}</td>
                        <td>{period.requests}</td>
                        <td>{formatTokens(period.output)}</td>
                        <td>{formatTokens(period.cacheRead)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.topModels.length > 0 && (
                  <div className="usage-models">
                    {summary.topModels.map((model) => (
                      <div key={model.model} className="usage-model-row">
                        <span className="usage-model-name">{model.model}</span>
                        <span className="usage-model-stats">
                          {model.requests} odp. · {formatTokens(model.output)} wyj.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="usage-note placeholder">
                  Z {summary.scannedFiles} transkryptów (~/.claude/projects), ostatnie 30 dni.
                  Tokeny okna: wejście+wyjście, bez cache.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
