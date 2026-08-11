import { BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';
import { detachedQuery, type DetachedTarget } from '../shared/detached';

/**
 * Okna oderwanych paneli i kart edytora (M62). W odróżnieniu od okien
 * terminali nie trzymają procesów — to widoki tego samego projektu, więc
 * zamknięcie okna niczego nie ubija.
 */

export function openDetachedWindow(info: DetachedTarget): void {
  const win = new BrowserWindow({
    width: info.kind === 'panel' ? 420 : 900,
    height: info.kind === 'panel' ? 620 : 700,
    minWidth: 320,
    minHeight: 240,
    title: `${info.title} — Sufler`,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1f24' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });
  const query = detachedQuery(info);
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    void win.loadURL(`${devServerUrl}?${new URLSearchParams(query).toString()}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query });
  }
}
