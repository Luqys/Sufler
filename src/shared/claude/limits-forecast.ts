/**
 * Prognoza wyczerpania limitu (M57): z kilku ostatnich pomiarów zużycia
 * liczymy tempo i przewidujemy moment osiągnięcia 100%. Czysta logika —
 * testowana jednostkowo.
 */

export interface UsageSample {
  /** Znacznik czasu pomiaru (ms). */
  at: number;
  /** Zużycie okna w procentach. */
  percent: number;
}

/** Próg, od którego ostrzegamy o kończącym się oknie. */
export const WARN_THRESHOLD = 80;

/** Ile pomiarów trzymamy — starsze nie mówią nic o bieżącym tempie. */
export const MAX_SAMPLES = 40;

export function pushSample(
  samples: readonly UsageSample[],
  sample: UsageSample,
): UsageSample[] {
  // Reset okna (zużycie spada) unieważnia historię — tempo liczymy od nowa.
  const previous = samples[samples.length - 1];
  const base = previous && sample.percent < previous.percent ? [] : samples;
  return [...base, sample].slice(-MAX_SAMPLES);
}

/**
 * Ile milisekund zostało do 100% przy obecnym tempie; null gdy za mało
 * danych, tempo jest zerowe albo limit już wyczerpany.
 */
export function forecastExhaustion(samples: readonly UsageSample[]): number | null {
  if (samples.length < 2) {
    return null;
  }
  const last = samples[samples.length - 1];
  const first = samples[0];
  if (!last || !first || last.percent >= 100) {
    return null;
  }
  const elapsed = last.at - first.at;
  const growth = last.percent - first.percent;
  // Poniżej minuty obserwacji albo bez wzrostu prognoza byłaby zgadywaniem.
  if (elapsed < 60_000 || growth <= 0) {
    return null;
  }
  const perMs = growth / elapsed;
  return Math.round((100 - last.percent) / perMs);
}

/** Czy przekroczono próg ostrzeżenia (i nie ostrzegaliśmy jeszcze w tym oknie). */
export function shouldWarn(
  percent: number,
  alreadyWarnedAt: number | null,
  threshold = WARN_THRESHOLD,
): boolean {
  if (percent < threshold) {
    return false;
  }
  // Po resecie okna (zużycie spadło poniżej progu) ostrzegamy ponownie.
  return alreadyWarnedAt === null || percent < alreadyWarnedAt;
}

/** „za 1 godz. 20 min" / „za 25 min" — bez zależności od i18n. */
export function formatDuration(ms: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(ms / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
