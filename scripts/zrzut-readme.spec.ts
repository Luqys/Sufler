/// <reference lib="dom" />
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../e2e/utils';

/**
 * Generator zrzutu do README — nie jest testem, więc leży poza katalogiem e2e
 * i nie wchodzi do suity. Uruchomienie:
 *   npx playwright test scripts/zrzut-readme.spec.ts
 */
test('zrzut do README', async () => {
  const fixture = makeFixtureProject();
  // Czytelna nazwa projektu w pasku tytułu zamiast katalogu tymczasowego.
  const project = join(dirname(fixture), 'demo-projekt');
  rmSync(project, { recursive: true, force: true });
  renameSync(fixture, project);
  // Notatki z powiązaniami, żeby graf i panel Wiedza miały co pokazać.
  const notes: Array<[string, string]> = [
    ['architektura.md', '---\ntagi: [projekt, backend]\n---\n\n# Architektura\n\nModuły i przepływ danych. Zobacz [[model-danych]] oraz [[uprawnienia]].\n'],
    ['model-danych.md', '---\ntagi: backend\n---\n\n# Model danych\n\nTabele i migracje; wraca do [[architektura]].\n'],
    ['uprawnienia.md', '# Uprawnienia\n\nRole i logowanie — zobacz [[model-danych]].\n'],
    ['realtime.md', '# Realtime\n\nKanały zdarzeń, [[architektura]].\n'],
  ];
  for (const [name, body] of notes) {
    writeFileSync(join(project, name), body);
  }
  mkdirSync(join(project, 'dziennik-sesji'), { recursive: true });
  writeFileSync(
    join(project, 'dziennik-sesji', '2026-08-11-a1b2c3d4.md'),
    '---\nkategoria: Dziennik sesji\ndata: 2026-08-11T09:30:00.000Z\n---\n\n# Dziennik sesji\n\n## 09:30 — polecenie\n\nDodaj panel historii pracy\n\n- `09:31` edycja: `src/app.ts`\n',
  );
  execFileSync('git', ['-c', 'user.email=n3o@sufler.dev', '-c', 'user.name=N3O', 'add', '-A'], { cwd: project });
  execFileSync('git', ['-c', 'user.email=n3o@sufler.dev', '-c', 'user.name=N3O', 'commit', '-m', 'Notatki projektu'], { cwd: project });

  const configHome = makeConfigHome();
  mkdirSync(join(configHome, 'sufler'), { recursive: true });
  writeFileSync(
    join(configHome, 'sufler', 'state.json'),
    JSON.stringify({ appearance: { mode: 'dark', accent: 'clay', language: 'pl' } }),
  );

  // Neutralny prompt powłoki — bez nazwy użytkownika i hosta na zrzucie.
  const zdotdir = join(dirname(project), 'zdot-zrzut');
  mkdirSync(zdotdir, { recursive: true });
  writeFileSync(join(zdotdir, '.zshrc'), "PROMPT='sufler %1~ %% '\nclear\n");

  const app = await launchApp(configHome, project, { ZDOTDIR: zdotdir });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Pusty prawy dok zjadałby ćwiartkę kadru — chowamy go skrótem.
  await page.keyboard.press('Meta+Shift+C');
  await page.getByTestId('rail-knowledge').click();
  await page.waitForTimeout(2500);
  // Panel plików czyta się na zrzucie lepiej niż akapit opisu Wiedzy.
  await page.getByTestId('rail-files').click();
  await page.getByTestId('bottom-new-terminal').click();
  await page.waitForTimeout(1200);
  await page.locator('[data-testid=bottom-dock] .xterm').click();
  await page.keyboard.type('git status --short');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  await page.screenshot({ path: 'docs/obrazy/sufler.png' });
  await app.close();
});
