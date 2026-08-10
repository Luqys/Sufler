/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

/** 1×1 czerwony PNG — atrapa zrzutu ekranu w schowku. */
const RED_DOT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('obrazek ze schowka trafia jako ścieżka do czatu i do terminala', async () => {
  test.setTimeout(60_000);
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_CHAT_FAKE: '1',
  });
  const page = await app.firstWindow();

  // Bitmapa w systemowym schowku (proces main ma dostęp do clipboard).
  await app.evaluate(({ clipboard, nativeImage }, dataUrl) => {
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
  }, RED_DOT_PNG);

  // Czat: [+] wstawia ścieżkę zapisanego obrazka do pola wejściowego.
  await page.getByTestId('open-chat').click();
  await page.getByTestId('chat-attach').click();
  await expect(page.getByTestId('chat-input')).toHaveValue(/neodesk-obrazki[^ ]+\.png/);

  // Terminal: syntetyczne wklejenie obrazka (bez tekstu) wkleja ścieżkę do pty.
  await page.getByTestId('bottom-new-terminal').click();
  const terminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(terminal).toBeVisible();
  await page.evaluate(() => {
    const textarea = document.querySelector('[data-testid=bottom-dock] .xterm-helper-textarea');
    if (!textarea) {
      throw new Error('brak pola tekstowego xterm');
    }
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'zrzut.png', { type: 'image/png' }));
    textarea.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(terminal).toContainText('neodesk-obrazki', { timeout: 15_000 });

  await page.screenshot({ path: 'e2e-artifacts/m24-obrazki.png' });
  await app.close();
});
