import { useEffect, useState, type ReactElement } from 'react';
import { formatTokens, type UsageSummary } from '../../../shared/usage';

function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Pigułka sesji na pasku tytułu: postęp czasowy bieżącego okna 5h, godzina
 * resetu i tokeny tego okna. Liczone lokalnie z transkryptów; pasek tyka
 * co minutę, skan odświeża się co 5 minut.
 */
export function UsageIndicator(): ReactElement {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);

  const refresh = (force: boolean): void => {
    setLoading(true);
    void window.api.getUsage(force).then((data) => {
      setSummary(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh(false);
    // Tykanie paska czasu + okresowe odświeżenie skanu (cache 5 min po stronie main).
    const minute = window.setInterval(() => setTick((value) => value + 1), 60_000);
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

  return (
    <div className="usage-wrap">
      <button
        type="button"
        className="usage-pill"
        data-testid="usage-button"
        title={
          block
            ? `Okno 5h: ${clockTime(block.windowStart)}–${clockTime(block.windowEnd)} · ` +
              `zużyte ${formatTokens(block.currentTokens)} tokenów · reset o ${clockTime(block.windowEnd)}`
            : 'Zużycie Claude Code (lokalnie z transkryptów)'
        }
        onClick={toggle}
      >
        <span className="usage-pill-bar" aria-hidden>
          <i style={{ width: `${timePercent}%` }} />
        </span>
        {block ? (
          <span className="usage-pill-text" data-testid="usage-window-tokens">
            {formatTokens(block.currentTokens)} · do {clockTime(block.windowEnd)}
          </span>
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
