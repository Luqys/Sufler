import { useEffect, useState, type ReactElement } from 'react';
import {
  totalTokens,
  type UsageScan,
  type UsageTotals,
} from '../../../shared/usage-history';
import { getLocale, useT } from '../i18n';

function formatTokens(value: number): string {
  return new Intl.NumberFormat(getLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Zużycie tokenów projektu (M73, uproszczone w M77): suma z transkryptów
 * i rozbicie na modele, zwinięte pod jednym wierszem. Liczone na żądanie —
 * pliki transkryptów bywają wielomegabajtowe.
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

  const parts: Array<[string, keyof UsageTotals]> = [
    [t('usage.input'), 'input'],
    [t('usage.output'), 'output'],
    [t('usage.cacheWrite'), 'cacheWrite'],
    [t('usage.cacheRead'), 'cacheRead'],
  ];

  // M77: bez wykresu dziennego i bez plakietek — słupki nic nie mówiły o pracy,
  // a zabierały górę panelu Sesje. Zostaje suma i rozbicie liczbami, domyślnie
  // zwinięte: kto potrzebuje, rozwija jednym kliknięciem.
  return (
    <details className="usage-history" data-testid="usage-history">
      <summary>
        {t('usage.history')}{' '}
        <span className="group-count" data-testid="usage-total">
          {formatTokens(totalTokens(scan.totals))}
        </span>
      </summary>
      <dl className="usage-figures" data-testid="usage-figures">
        {parts.map(([label, key]) => (
          <div key={key} className="usage-figure">
            <dt>{label}</dt>
            <dd>{formatTokens(scan.totals[key])}</dd>
          </div>
        ))}
      </dl>
      {scan.byModel.map((entry) => (
        <div key={entry.model} className="usage-model" data-testid="usage-model">
          <span className="usage-model-name" title={entry.model}>
            {entry.model}
          </span>
          <span className="usage-model-value">{formatTokens(totalTokens(entry.totals))}</span>
        </div>
      ))}
    </details>
  );
}
