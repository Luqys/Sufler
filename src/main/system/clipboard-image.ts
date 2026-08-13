import { clipboard } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SaveClipboardImageResult } from '../../shared/ipc';

/**
 * Obrazek ze schowka → plik PNG w katalogu tymczasowym. Claude Code czyta
 * obrazki po ścieżce, więc wklejenie do terminala/czatu wstawia tę ścieżkę.
 */

let counter = 0;

export function saveClipboardImage(): SaveClipboardImageResult {
  const image = clipboard.readImage();
  if (image.isEmpty()) {
    return { ok: false };
  }
  const dir = join(tmpdir(), 'sufler-obrazki');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[T:]/g, '-');
  const path = join(dir, `schowek-${stamp}-${++counter}.png`);
  writeFileSync(path, image.toPNG());
  return { ok: true, path };
}
