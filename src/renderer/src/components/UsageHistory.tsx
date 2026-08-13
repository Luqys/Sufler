import { useEffect, useState, type ReactElement } from 'react';
import {
  lastDays,
  totalTokens,
  type UsageScan,
  type UsageTotals,
} from '../../../shared/usage-history';
import { getLocale, tf, useT } from '../i18n';

/** Ile dni pokazuje wykres — dwa tygodnie mieszczą się w szerokości panelu. */
const DAYS = 14;

function formatTokens(value: number): string {
  return new Intl.NumberFormat(getLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function dayLabel(date: string): string {
  const parsed = Date.parse(`${date}T12:00:00`);
  return Number.isNaN(parsed)
    ? date
    : new Date(parsed).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
}

/**
 * Historia zużycia projektu (M73): suma tokenów z transkryptów, wykres
 * ostatnich dwóch tygodni i rozbicie na modele. Liczone na żądanie — pliki
 * transkryptów bywają wielomegabajtowe.
 */
export function UsageHistory({ root, reloadKey }: { root: string; reloadKey: number }): ReactElement | null {
  const t = useT();
  const [scan, setScan] = useState<UsageScan | null>(null);

  useEffect(() => {
    let cancelled = false;
    setScan(null);
    void window.api.getUsageHistory(root).then((result) => {
      if (!cancelled) {
        setScan(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [root, reloadKey]);

  if (scan === null) {
    return <p className="placeholder">{t('usage.historyLoading')}</p>;
  }
  if (scan.totals.replies === 0) {
    // Projekt bez ani jednej odpowiedzi modelu — nie zaśmiecamy panelu pustym wykresem.
    return null;
  }

  const days = lastDays(scan, new Date().toISOString(), DAYS);
  const peak = Math.max(...days.map((day) => totalTokens(day.totals)), 1);
  const parts: Array<[string, keyof UsageTotals]> = [
    [t('usage.input'), 'input'],
    [t('usage.output'), 'output'],
    [t('usage.cacheWrite'), 'cacheWrite'],
    [t('usage.cacheRead'), 'cacheRead'],
  ];

  return (
    <details className="usage-history" data-testid="usage-history" open>
      <summary>
        {t('usage.history')}{' '}
        <span className="group-count" data-testid="usage-total">
          {formatTokens(totalTokens(scan.totals))}
        </span>
      </summary>
      <div className="usage-bars" data-testid="usage-bars">
        {days.map((day) => {
          const total = totalTokens(day.totals);
          return (
            <span
              key={day.date}
              className="usage-bar"
              data-testid="usage-bar"
              title={tf('usage.dayTitle', {
                day: dayLabel(day.date),
                tokens: formatTokens(total),
              })}
            >
              <span
                className={`usage-bar-fill${total === 0 ? ' empty' : ''}`}
                style={{ height: `${Math.max(2, Math.round((total / peak) * 100))}%` }}
              />
            </span>
          );
        })}
      </div>
      <div className="usage-legend">
        {parts.map(([label, key]) => (
          <span key={key} className="badge" title={label}>
            {label}: {formatTokens(scan.totals[key])}
          </span>
        ))}
      </div>
      {scan.byModel.map((entry) => (
        <div key={entry.model} className="usage-model" data-testid="usage-model">
          <span className="usage-model-name" title={entry.model}>
            {entry.model}
          </span>
          <span className="badge">{formatTokens(totalTokens(entry.totals))}</span>
        </div>
      ))}
    </details>
  );
}
