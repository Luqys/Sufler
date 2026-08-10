/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from './utils';

function startTestServer(): Promise<Server> {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(
      '<html><body><main><h1>Aplikacja testowa</h1>' +
        '<button id="kup" class="cta duza">Kup teraz</button></main></body></html>',
    );
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('podgląd przeglądarki ładuje localhost, a wskazany element trafia do sesji Claude', async () => {
  const server = await startTestServer();
  const port = (server.address() as AddressInfo).port;
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  // Sesja Claude, do której poleci odniesienie.
  await page.getByTestId('bottom-new-claude').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('atrapa', {
    timeout: 15_000,
  });

  // Zakładka podglądu w obszarze edytora.
  await page.getByTestId('open-preview').click();
  await expect(page.getByTestId('tab-active')).toContainText('Podgląd');
  await expect(page.getByTestId('browser-preview')).toBeVisible();

  await page.getByTestId('preview-address').fill(`127.0.0.1:${port}`);
  await page.getByTestId('preview-go').click();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const webview = document.querySelector('webview') as unknown as {
            getURL?: () => string;
          } | null;
          return webview?.getURL ? webview.getURL() : '';
        }),
      { timeout: 15_000 },
    )
    .toContain(`${port}`);

  const guestText = await page.evaluate(() =>
    (
      document.querySelector('webview') as unknown as {
        executeJavaScript(code: string): Promise<unknown>;
      }
    ).executeJavaScript('document.body.innerText'),
  );
  expect(String(guestText)).toContain('Kup teraz');

  // Tryb wskazywania: klik w przycisk na stronie → odniesienie w terminalu Claude.
  await page.getByTestId('preview-pick').click();
  await page.evaluate(() =>
    (
      document.querySelector('webview') as unknown as {
        executeJavaScript(code: string): Promise<unknown>;
      }
    ).executeJavaScript(
      "document.querySelector('#kup').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))",
    ),
  );

  const claudeTerminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(claudeTerminal).toContainText('#kup', { timeout: 15_000 });
  await expect(claudeTerminal).toContainText('Kup teraz', { timeout: 15_000 });

  await page.screenshot({ path: 'e2e-artifacts/m10-podglad-przegladarki.png' });
  await app.close();
  server.close();
});
