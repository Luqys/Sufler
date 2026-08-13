import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('M74: Cmd+K otwiera paletę, fraza filtruje, Enter wykonuje akcję', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await expect(page.getByTestId('sidebar')).toBeVisible();
  await page.keyboard.press('Meta+k');

  const palette = page.getByTestId('command-palette');
  await expect(palette).toBeVisible();
  // Bez frazy paleta jest spisem treści aplikacji — z nagłówkami grup.
  await expect(palette).toContainText('Panele');
  await expect(palette).toContainText('Doki');
  await expect(page.getByTestId('command-palette-item').first()).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m74-paleta.png' });

  // Fraza zawęża listę do jednej pozycji.
  await page.getByTestId('command-palette-input').fill('historia git');
  const items = page.getByTestId('command-palette-item');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Historia git');

  // Enter przełącza panel boczny na historię gita.
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(page.getByTestId('git-panel')).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m74-paleta-akcja.png' });

  // Escape zamyka paletę bez wykonywania akcji.
  await page.keyboard.press('Meta+k');
  await expect(palette).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();

  await app.close();
});

test('M74: paleta otwiera panel także wtedy, gdy sidebar jest schowany', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await expect(page.getByTestId('sidebar')).toBeVisible();
  await page.keyboard.press('Meta+b');
  await expect(page.getByTestId('sidebar')).toBeHidden();

  await page.keyboard.press('Meta+k');
  await page.getByTestId('command-palette-input').fill('skille');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('sidebar')).toBeVisible();
  await expect(page.getByTestId('skills-panel')).toBeVisible();

  await app.close();
});
