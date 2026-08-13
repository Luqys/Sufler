import { join } from 'node:path';

/**
 * Wspólne `webPreferences` wszystkich okien aplikacji (M89).
 *
 * Jedno miejsce zamiast trzech kopii, bo różnica między nimi sprowadza się do
 * jednej flagi, a rozjazd kosztowałby ciszej niż widać: okno odczepione bez
 * `backgroundThrottling: false` rysowałoby wyjście terminala z opóźnieniem,
 * gdy patrzysz na inne okno — czyli dokładnie wtedy, gdy się je odczepia.
 * Chromium dławi w tle timery i `requestAnimationFrame`, a na tym drugim stoi
 * renderer xterma.
 */
export function oknoWebPreferences(opcje: { webview?: boolean } = {}): {
  preload: string;
  sandbox: false;
  backgroundThrottling: false;
  webviewTag?: boolean;
} {
  return {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    backgroundThrottling: false,
    ...(opcje.webview ? { webviewTag: true } : {}),
  };
}
