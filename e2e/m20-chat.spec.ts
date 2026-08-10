import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('tryb czatu: wysłanie wiadomości, wpis narzędzia i odpowiedź (atrapa SDK)', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_CHAT_FAKE: '1',
  });
  const page = await app.firstWindow();

  await page.getByTestId('open-chat').click();
  await expect(page.getByTestId('chat-view')).toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('Czat');

  await page.getByTestId('chat-input').fill('Cześć, co widzisz w projekcie?');
  await page.keyboard.press('Enter');

  await expect(page.locator('.chat-msg.user')).toContainText('Cześć, co widzisz w projekcie?');
  await expect(page.locator('.chat-tool')).toContainText('Read');
  await expect(page.locator('.chat-msg.assistant')).toContainText('Atrapa odpowiedzi', {
    timeout: 10_000,
  });

  // Po 'done' input znów aktywny, a „Nowa rozmowa" czyści historię.
  await expect(page.getByTestId('chat-send')).toBeDisabled(); // puste pole
  await page.screenshot({ path: 'e2e-artifacts/m20-czat.png' });

  await page.getByTestId('chat-reset').click();
  await expect(page.locator('.chat-msg')).toHaveCount(0);

  await app.close();
});
