import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Dwa poziomy w górę: e2e/start/ → korzeń repozytorium (M81: spece w podkatalogach).
const ROOT = join(__dirname, '..', '..');

test('ikona aplikacji to znak N3O — poprawny PNG i pakiet .icns', () => {
  const png = join(ROOT, 'build', 'icon.png');
  const icns = join(ROOT, 'build', 'icon.icns');
  expect(existsSync(png)).toBe(true);
  expect(existsSync(icns)).toBe(true);

  // Nagłówek PNG + rozmiar 1024×1024 (bajty 16–23 nagłówka IHDR).
  const bytes = readFileSync(png);
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1024);
  expect(bytes.readUInt32BE(20)).toBe(1024);

  // Pakiet .icns zaczyna się magiczną sygnaturą i niesie komplet rozmiarów.
  const iconBytes = readFileSync(icns);
  expect(iconBytes.subarray(0, 4).toString('latin1')).toBe('icns');
  expect(statSync(icns).size).toBeGreaterThan(100_000);
});
