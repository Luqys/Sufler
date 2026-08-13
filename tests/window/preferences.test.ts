import { describe, expect, it } from 'vitest';
import { oknoWebPreferences } from '../../src/main/window/preferences';

describe('oknoWebPreferences', () => {
  it('każde okno ma wyłączone dławienie w tle', () => {
    // Strażnik ustawienia, nie zachowania: dławienie tła dotyka rysowania
    // i requestAnimationFrame, więc scenariusz e2e czytający DOM przechodzi
    // także BEZ tej flagi (sprawdzone) — taki test niczego by nie pilnował.
    expect(oknoWebPreferences().backgroundThrottling).toBe(false);
    expect(oknoWebPreferences({ webview: true }).backgroundThrottling).toBe(false);
  });

  it('most preload i wyłączony sandbox są wspólne dla wszystkich okien', () => {
    const preferencje = oknoWebPreferences();
    expect(preferencje.preload).toContain('preload');
    expect(preferencje.sandbox).toBe(false);
  });

  it('webview tylko tam, gdzie jest podgląd przeglądarki', () => {
    expect(oknoWebPreferences().webviewTag).toBeUndefined();
    expect(oknoWebPreferences({ webview: true }).webviewTag).toBe(true);
  });
});
