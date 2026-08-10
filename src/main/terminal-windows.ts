import { BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';
import type { DetachedTerminalInfo } from '../shared/ipc';
import { killPty } from './pty-manager';

/**
 * Odczepione okna terminali: karta wyciągnięta poza okno główne żyje we
 * własnym BrowserWindow. Proces (ptyId) zostaje w main; scrollback wjeżdża
 * jako zserializowany bufor xterm. Zamknięcie okna ubija proces —
 * jak zamknięcie karty.
 */

const infos = new Map<number, DetachedTerminalInfo>();

export function getDetachedInfo(ptyId: number): DetachedTerminalInfo | null {
  return infos.get(ptyId) ?? null;
}

export function openTerminalWindow(info: DetachedTerminalInfo): void {
  infos.set(info.ptyId, info);
  const win = new BrowserWindow({
    width: 760,
    height: 480,
    minWidth: 420,
    minHeight: 280,
    title: `${info.title} — Sufler`,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1c21' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    void win.loadURL(`${devServerUrl}?window=terminal&ptyId=${info.ptyId}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'terminal', ptyId: String(info.ptyId) },
    });
  }
  win.on('closed', () => {
    infos.delete(info.ptyId);
    killPty(info.ptyId);
  });
}
