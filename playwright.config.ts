import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  /*
   * Jedno powtórzenie (M82). Scenariusze sterują PRAWDZIWYM oknem macOS, więc
   * część padów pochodzi spoza aplikacji: przejęcie fokusu przez inne okno,
   * chwilowe obciążenie maszyny. Zmierzone: ~1 pad na 120 uruchomień testu,
   * za każdym razem inny scenariusz, zawsze zielony przy powtórce.
   *
   * UWAGA: „flaky" w raporcie NIE jest zielonym światłem — oznacza, że test
   * padł za pierwszym razem. Przy każdym takim wpisie sprawdzić przyczynę,
   * zanim uzna się kamień za skończony.
   */
  retries: 1,
  outputDir: './e2e-artifacts/test-results',
  // Lista na ekran + zbieranie przyczyn padów do TSV (M91) — bez tego seria
  // przebiegów daje tylko „mignęło", a nie rozkład, który cokolwiek rozstrzyga.
  reporter: [['list'], ['./e2e/reporter-flaki.ts']],
});
