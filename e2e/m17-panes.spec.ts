import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('podział doku: dwie sesje widoczne obok siebie, każda niezależna', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  // Dwa terminale w jednym panelu dolnego doku.
  await page.getByTestId('bottom-dock-add').click();
  await page.getByTestId('bottom-menu-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible();
  await page.keyboard.type('echo splitA-$((1+1))');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('splitA-2', {
    timeout: 15_000,
  });

  await page.getByTestId('bottom-dock-add').click();
  await page.getByTestId('bottom-menu-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab')).toHaveCount(2);
  await page.keyboard.type('echo splitB-$((2+2))');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('splitB-4', {
    timeout: 15_000,
  });

  // Podział: aktywna karta wyjeżdża do panelu obok — obie sesje widoczne NARAZ.
  await page.getByTestId('bottom-pane-split').click();
  const pane0 = page.getByTestId('bottom-pane-0');
  const pane1 = page.getByTestId('bottom-pane-1');
  await expect(pane1).toBeVisible();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toHaveCount(2);
  await expect(pane0.locator('.xterm')).toContainText('splitA-2');
  await expect(pane1.locator('.xterm')).toContainText('splitB-4');

  // Wpis w prawym panelu nie dotyka lewego.
  await pane1.locator('.xterm').click();
  await page.keyboard.type('echo splitC-$((3+3))');
  await page.keyboard.press('Enter');
  await expect(pane1.locator('.xterm')).toContainText('splitC-6', { timeout: 15_000 });
  await expect(pane0.locator('.xterm')).not.toContainText('splitC-6');

  await page.screenshot({ path: 'e2e-artifacts/m17-podzial-doku.png' });
  await app.close();
});
