import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('M104: pasek MCP z etykietami, a klik w serwer rozwija czytelną kartę', async () => {
  const project = makeFixtureProject();
  writeFileSync(
    join(project, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        supabase: { type: 'http', url: 'https://api.supabase.example/mcp/v1/projekt-demo' },
      },
    }),
  );
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-mcp').click();
  const panel = page.getByTestId('mcp-panel');
  await expect(panel).toBeVisible();

  // Obie akcje mają etykiety i wspólny pasek — nie dwie nagie ikony w rogu.
  await expect(page.getByTestId('mcp-add')).toContainText('+ Serwer');
  await expect(page.getByTestId('mcp-refresh')).toContainText('Odśwież');
  const dodaj = (await page.getByTestId('mcp-add').boundingBox())!;
  const odswiez = (await page.getByTestId('mcp-refresh').boundingBox())!;
  expect(Math.abs(dodaj.y - odswiez.y)).toBeLessThan(2);
  expect(dodaj.height).toBeLessThan(34);

  // Karta serwera: stan, adres i transport w dwóch kolumnach.
  await panel.locator('.mcp-row').first().click();
  const karta = page.getByTestId('mcp-details');
  await expect(karta).toBeVisible();
  await expect(karta).toContainText('Adres');
  await expect(karta).toContainText('api.supabase.example');
  await expect(karta).toContainText('Transport');
  await expect(karta).toContainText('http');

  // Wartości zaczynają się w jednej kolumnie — klucz nie wpycha ich w prawo.
  const wartosci = await karta.locator('dd').evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().left)),
  );
  expect(new Set(wartosci).size).toBe(1);
  await page.screenshot({ path: 'e2e-artifacts/m104-karta-serwera.png' });

  // Ponowny klik zwija kartę.
  await panel.locator('.mcp-row').first().click();
  await expect(karta).toHaveCount(0);

  await app.close();
});
