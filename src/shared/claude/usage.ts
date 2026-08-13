/** Formatowanie liczby tokenów w UI. */

/** 1234 → „1,2 tys.", 5 600 000 → „5,6 mln"; poniżej tysiąca — pełna liczba. */
export function formatTokens(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  if (value < 1_000_000) {
    return `${(value / 1000).toFixed(1).replace('.', ',')} tys.`;
  }
  return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mln`;
}
