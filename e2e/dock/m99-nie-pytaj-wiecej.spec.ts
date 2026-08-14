import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('„nie pytaj więcej" zamyka kolejne karty z procesem bez dialogu', async () => {
  const configHome = makeConfigHome();
  const app = await launchApp(configHome, makeFixtureProject());
  const page = await app.firstWindow();

  const dock = page.locator('[data-testid=bottom-dock]');
  await page.getByTestId('bottom-new-terminal').click();
  await expect(dock.locator('.xterm')).toBeVisible();

  // Pierwsze zamknięcie pyta — zaznaczamy „nie pytaj więcej" i potwierdzamy.
  await dock.locator('.dock-tab .tab-close').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-dont-ask').check();
  await page.screenshot({ path: 'e2e-artifacts/m99-dialog-nie-pytaj.png' });
  await page.getByTestId('confirm-accept').click();
  await expect(dock.locator('.dock-tab')).toHaveCount(0);

  // Druga karta znika od razu, bez pytania.
  await page.getByTestId('bottom-new-terminal').click();
  await expect(dock.locator('.xterm')).toBeVisible();
  await dock.locator('.dock-tab .tab-close').click();
  await expect(dock.locator('.dock-tab')).toHaveCount(0);
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);

  // Wybór jest trwały: siedzi w state.json i widać go w Ustawieniach.
  const state = JSON.parse(
    readFileSync(join(configHome, 'sufler', 'state.json'), 'utf8'),
  ) as Record<string, unknown>;
  expect(state['confirmCloseTab']).toBe(false);

  await page.getByTestId('settings-button').click();
  const toggle = page.getByTestId('confirm-close-tab');
  await page.getByTestId('tabs-section').scrollIntoViewIfNeeded();
  await expect(toggle).not.toBeChecked();
  await page.screenshot({ path: 'e2e-artifacts/m99-ustawienie-kart.png' });

  // Przełącznik przywraca pytanie — karta znów prosi o potwierdzenie.
  await toggle.check();
  await page.getByTestId('bottom-new-terminal').click();
  await expect(dock.locator('.xterm')).toBeVisible();
  await dock.locator('.dock-tab .tab-close').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-accept').click();

  await app.close();
});
