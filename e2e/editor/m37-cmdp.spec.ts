import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('Cmd+P: fuzzy-otwieranie pliku, .gitignore respektowany, Esc zamyka', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  await expect(page.getByTestId('editor')).toBeVisible();

  await page.keyboard.press('Meta+p');
  const overlay = page.getByTestId('quick-open');
  await expect(overlay).toBeVisible();

  // Fuzzy: „app" → src/app.ts na szczycie.
  await page.getByTestId('quick-open-input').fill('app');
  const items = page.getByTestId('quick-open-item');
  await expect(items.first()).toContainText('src/app.ts');
  await page.screenshot({ path: 'e2e-artifacts/m37-cmdp.png' });

  // debug.log jest w .gitignore (*.log) — nie ma go na liście.
  await page.getByTestId('quick-open-input').fill('debug');
  await expect(page.getByTestId('quick-open-item')).toHaveCount(0);
  await expect(overlay).toContainText('Brak pasujących plików.');

  // Enter otwiera zaznaczony plik i zamyka nakładkę.
  await page.getByTestId('quick-open-input').fill('app');
  await expect(items.first()).toContainText('src/app.ts');
  await page.keyboard.press('Enter');
  await expect(overlay).not.toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('app.ts');

  // Esc zamyka bez otwierania.
  await page.keyboard.press('Meta+p');
  await expect(page.getByTestId('quick-open')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('quick-open')).not.toBeVisible();

  await app.close();
});
