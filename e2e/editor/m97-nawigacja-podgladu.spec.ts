/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Dwie strony połączone odnośnikiem — tyle wystarczy na historię przeglądania. */
function startTestServer(): Promise<Server> {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if ((request.url ?? '/').startsWith('/druga')) {
      response.end('<html><body><h1>Druga strona</h1></body></html>');
      return;
    }
    response.end(
      '<html><body><h1>Pierwsza strona</h1>' +
        '<a id="dalej" href="/druga">Przejdź dalej</a></body></html>',
    );
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('strzałki podglądu cofają i przewijają historię przeglądania', async () => {
  const server = await startTestServer();
  const port = (server.address() as AddressInfo).port;
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('open-preview').click();
  await expect(page.getByTestId('browser-preview')).toBeVisible();

  const address = page.getByTestId('preview-address');
  const back = page.getByTestId('preview-back');
  const forward = page.getByTestId('preview-forward');

  // Bez wczytanej strony nie ma dokąd iść.
  await expect(back).toBeDisabled();
  await expect(forward).toBeDisabled();

  await address.fill(`127.0.0.1:${port}`);
  await page.getByTestId('preview-go').click();
  await expect(address).toHaveValue(`http://127.0.0.1:${port}/`, { timeout: 15_000 });
  await expect(back).toBeDisabled();

  // Przejście odnośnikiem wewnątrz strony gościa.
  await page.evaluate(() =>
    (
      document.querySelector('webview') as unknown as {
        executeJavaScript(code: string): Promise<unknown>;
      }
    ).executeJavaScript("document.querySelector('#dalej').click()"),
  );
  await expect(address).toHaveValue(`http://127.0.0.1:${port}/druga`, { timeout: 15_000 });
  await expect(back).toBeEnabled();
  await expect(forward).toBeDisabled();

  await back.click();
  await expect(address).toHaveValue(`http://127.0.0.1:${port}/`, { timeout: 15_000 });
  await expect(forward).toBeEnabled();

  await forward.click();
  await expect(address).toHaveValue(`http://127.0.0.1:${port}/druga`, { timeout: 15_000 });
  await expect(forward).toBeDisabled();

  // Skrót Alt+← wciśnięty na stronie gościa — obsługuje go preload webview.
  await page.evaluate(() =>
    (
      document.querySelector('webview') as unknown as {
        executeJavaScript(code: string): Promise<unknown>;
      }
    ).executeJavaScript(
      "document.dispatchEvent(new KeyboardEvent('keydown', " +
        "{ key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }))",
    ),
  );
  await expect(address).toHaveValue(`http://127.0.0.1:${port}/`, { timeout: 15_000 });
  await expect(back).toBeDisabled();
  await expect(forward).toBeEnabled();

  await page.screenshot({ path: 'e2e-artifacts/m97-nawigacja-podgladu.png' });
  await app.close();
  server.close();
});
