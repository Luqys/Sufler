import { getLocale, t, tf } from './i18n';

/**
 * Czas względem teraz w języku UI: „przed chwilą", „12 min temu",
 * „3 godz. temu", „5 dn. temu", a powyżej miesiąca zwykła data.
 * Wywoływać w momencie renderu — wynik zależy od bieżącego języka.
 */
export function relativeTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '';
  }
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) {
    return t('git.justNow');
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return tf('git.minutesAgo', { minutes });
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return tf('git.hoursAgo', { hours });
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return tf('git.daysAgo', { days });
  }
  return new Date(ms).toLocaleDateString(getLocale());
}

/** Pełna data z godziną — do tooltipów obok czasu względnego. */
export function fullDateTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '';
  }
  return new Date(ms).toLocaleString(getLocale(), { dateStyle: 'long', timeStyle: 'short' });
}

/** Data skrócona — do wąskich paneli, gdzie „12 sierpnia 2026" łamie wiersz. */
export function compactDateTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '';
  }
  return new Date(ms).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

/** Sama godzina — wiersze podglądu rozmowy nie potrzebują daty. */
export function clockTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '';
  }
  return new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}
