import { defineConfig } from '@playwright/test';

/**
 * Osobna konfiguracja dla generatora zrzutu do README — trzyma go poza suitą
 * e2e, żeby nie wydłużał weryfikacji i nie nadpisywał obrazka przy każdym biegu.
 *   npx playwright test -c scripts/zrzut.config.ts
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'zrzut-readme.spec.ts',
  timeout: 120_000,
  workers: 1,
  outputDir: '../e2e-artifacts/test-results',
});
