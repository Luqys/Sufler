import { useState, type ReactElement } from 'react';
import { formatTokens, type UsageSummary } from '../../../shared/usage';

const ICON_GAUGE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M2 11.5a6 6 0 1 1 12 0" />
    <path d="M8 11.5L11 7" />
    <circle cx="8" cy="11.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Zużycie Claude Code liczone lokalnie z transkryptów ~/.claude/projects
 * (tokeny i liczba odpowiedzi; bez wyceny — ta zależy od planu).
 */
export function UsageIndicator(): ReactElement {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = (force: boolean): void => {
    setLoading(true);
    void window.api.getUsage(force).then((data) => {
      setSummary(data);
      setLoading(false);
    });
  };

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (next && !summary) {
      refresh(false);
    }
  };

  return (
    <div className="usage-wrap">
      <button
        type="button"
        className="titlebar-btn"
        data-testid="usage-button"
        title="Zużycie Claude Code (lokalnie z transkryptów)"
        onClick={toggle}
      >
        {ICON_GAUGE}
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
            {summary && (
              <>
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
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
