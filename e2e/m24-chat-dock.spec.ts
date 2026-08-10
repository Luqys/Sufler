import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('czat: ikony zakładek i przenosiny między edytorem a dokami', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_CHAT_FAKE: '1',
  });
  const page = await app.firstWindow();

  await page.getByTestId('open-chat').click();
  await expect(page.getByTestId('chat-view')).toBeVisible();
  // Zakładka edytora ma „favicon" (✳ dla czatu).
  await expect(page.getByTestId('tab-active').locator('.tab-icon')).toBeVisible();

  // Przenosiny do doku bocznego: czat znika z paska edytora, jest w doku.
  await page.getByTestId('chat-move-right').click();
  await expect(page.getByTestId('right-dock').getByTestId('chat-view')).toBeVisible();
  await expect(page.getByTestId('editor-tabs')).not.toContainText('Czat');
  await expect(page.getByTestId('right-dock').locator('.dock-tab-icon').first()).toBeVisible();

  // Dalej do doku dolnego.
  await page.getByTestId('chat-move-bottom').click();
  await expect(page.getByTestId('bottom-dock').getByTestId('chat-view')).toBeVisible();

  // Historia żyje w chat-store — przeżywa przenosiny z powrotem do edytora.
  await page.getByTestId('chat-input').fill('ping z doku');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-msg.user')).toContainText('ping z doku');

  await page.getByTestId('chat-move-editor').click();
  await expect(page.getByTestId('chat-view')).toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('Czat');
  await expect(page.locator('.chat-msg.user')).toContainText('ping z doku');

  await page.screenshot({ path: 'e2e-artifacts/m24-czat-doki.png' });
  await app.close();
});
