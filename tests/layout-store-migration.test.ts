import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyConfigDir } from '../src/main/window/layout-store';

/**
 * Łańcuch migracji katalogu konfiguracji po zmianach nazwy aplikacji:
 * visualn3o (do M24) → neodesk (M25) → sufler (M27).
 */
describe('migrateLegacyConfigDir', () => {
  let base: string;
  let saved: string | undefined;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'sufler-conf-'));
    saved = process.env['XDG_CONFIG_HOME'];
    process.env['XDG_CONFIG_HOME'] = base;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env['XDG_CONFIG_HOME'];
    } else {
      process.env['XDG_CONFIG_HOME'] = saved;
    }
  });

  const seed = (name: string, marker: string): void => {
    mkdirSync(join(base, name), { recursive: true });
    writeFileSync(join(base, name, 'layout.json'), marker);
  };

  it('przenosi ~/.config/neodesk na sufler', () => {
    seed('neodesk', 'z-neodesk');
    migrateLegacyConfigDir();
    expect(readFileSync(join(base, 'sufler', 'layout.json'), 'utf8')).toBe('z-neodesk');
    expect(existsSync(join(base, 'neodesk'))).toBe(false);
  });

  it('przenosi ~/.config/visualn3o, gdy nie ma neodesk', () => {
    seed('visualn3o', 'z-visualn3o');
    migrateLegacyConfigDir();
    expect(readFileSync(join(base, 'sufler', 'layout.json'), 'utf8')).toBe('z-visualn3o');
  });

  it('nowsza nazwa ma pierwszeństwo, starszy katalog zostaje nietknięty', () => {
    seed('neodesk', 'z-neodesk');
    seed('visualn3o', 'z-visualn3o');
    migrateLegacyConfigDir();
    expect(readFileSync(join(base, 'sufler', 'layout.json'), 'utf8')).toBe('z-neodesk');
    expect(existsSync(join(base, 'visualn3o'))).toBe(true);
  });

  it('nie nadpisuje istniejącej konfiguracji sufler', () => {
    seed('sufler', 'obecna');
    seed('neodesk', 'stara');
    migrateLegacyConfigDir();
    expect(readFileSync(join(base, 'sufler', 'layout.json'), 'utf8')).toBe('obecna');
  });
});
