import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

function localSettings(project: string): string {
  return join(project, '.claude', 'settings.local.json');
}

test('M70: hook dodany z Ustawień ląduje w settings.local.json i znika po usunięciu', async () => {
  const project = makeFixtureProject();
  // Wpis w warstwie projektu — lista ma pokazywać wszystkie warstwy, nie tylko swoją.
  mkdirSync(join(project, '.claude'), { recursive: true });
  writeFileSync(
    join(project, '.claude', 'settings.json'),
    JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say cudzy' }] }] } }),
  );

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await expect(page.getByTestId('workbench')).toBeVisible();
  await page.keyboard.press('Meta+Comma');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  const section = page.getByTestId('hooks-section');
  await section.scrollIntoViewIfNeeded();

  // Cudzy hook z warstwy projektu jest widoczny wraz z etykietą warstwy.
  const foreign = page.locator('[data-testid=hook-row]', { hasText: 'say cudzy' });
  await expect(foreign).toBeVisible();
  await expect(foreign).toContainText('Stop');

  // Nowy hook: zdarzenie narzędziowe z wzorcem.
  await page.getByTestId('hook-event').selectOption('PreToolUse');
  await page.getByTestId('hook-matcher').fill('Bash');
  await page.getByTestId('hook-command').fill('echo z-panelu');
  await page.getByTestId('hook-add').click();

  const added = page.locator('[data-testid=hook-row]', { hasText: 'echo z-panelu' });
  await expect(added).toBeVisible();
  await expect(added).toContainText('Bash');

  // Zapis poszedł do najmocniejszej warstwy, którą aplikacja może ruszać.
  const saved: unknown = JSON.parse(readFileSync(localSettings(project), 'utf8'));
  expect(JSON.stringify(saved)).toContain('echo z-panelu');

  await page.screenshot({ path: 'e2e-artifacts/m70-hooki.png' });

  // Usunięcie czyści wpis z pliku, cudzy hook zostaje.
  await added.getByTestId('hook-remove').click();
  await expect(added).toHaveCount(0);
  await expect(foreign).toBeVisible();
  expect(readFileSync(localSettings(project), 'utf8')).not.toContain('echo z-panelu');

  await app.close();
});

test('M70: pole wzorca znika dla zdarzeń niezwiązanych z narzędziami', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await expect(page.getByTestId('workbench')).toBeVisible();
  await page.keyboard.press('Meta+Comma');
  await page.getByTestId('hooks-section').scrollIntoViewIfNeeded();

  await page.getByTestId('hook-event').selectOption('PostToolUse');
  await expect(page.getByTestId('hook-matcher')).toBeVisible();

  await page.getByTestId('hook-event').selectOption('SessionEnd');
  await expect(page.getByTestId('hook-matcher')).toHaveCount(0);

  // Przycisk pozostaje nieaktywny, dopóki nie ma komendy.
  await expect(page.getByTestId('hook-add')).toBeDisabled();

  await app.close();
});
