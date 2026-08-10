import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

const PORT = 34987;

/** Wyciąga payloady data: z odpowiedzi SSE streamable HTTP. */
function sseData(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');
}

async function mcpCall(body: unknown): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return text.includes('data:') ? sseData(text) : text;
}

test('serwer MCP grafu wiedzy podaje schemat połączeń i treść notatek', async () => {
  const project = makeFixtureProject();
  const notes = join(project, 'notatki');
  mkdirSync(notes);
  writeFileSync(join(notes, 'Architektura.md'), '# Architektura\n\nZobacz [[Baza danych]].\n');
  writeFileSync(join(notes, 'Baza danych.md'), '# Baza danych\n\nSekret-mcp-testu.\n');

  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_MCP_PORT: String(PORT),
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  // Panel Wiedza pokazuje status serwera MCP.
  await page.getByTestId('rail-knowledge').click();
  await expect(page.getByTestId('knowledge-mcp')).toContainText('działa', { timeout: 15_000 });
  await expect(page.getByTestId('wiedza-mcp-register')).toBeVisible();

  // Handshake initialize (bezstanowy transport — każde żądanie niezależne).
  const init = await mcpCall({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-e2e', version: '1.0' },
    },
  });
  expect(init).toContain('visualn3o-graf-wiedzy');

  // Tryb bezstanowy: każde żądanie to świeży serwer — wywołanie idzie solo.
  const graph = await mcpCall({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'graf_wiedzy', arguments: {} },
  });
  expect(graph).toContain('Architektura.md');
  expect(graph).toContain('Baza danych.md');
  expect(graph).toContain('from');

  // Narzędzie notatka zwraca treść pliku.
  const note = await mcpCall({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'notatka', arguments: { sciezka: 'notatki/Baza danych.md' } },
  });
  expect(note).toContain('Sekret-mcp-testu');

  await page.screenshot({ path: 'e2e-artifacts/m20-wiedza-mcp.png' });
  await app.close();
});

test('zamknięcie karty pyta wewnętrznym dialogiem, nie systemowym', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible();

  let nativeDialogs = 0;
  page.on('dialog', () => {
    nativeDialogs += 1;
  });

  await page.locator('[data-testid=bottom-dock] .dock-tab .tab-close').click();
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('działający proces');
  await page.screenshot({ path: 'e2e-artifacts/m20-dialog-wewnetrzny.png' });

  // Anuluj zostawia kartę, potwierdzenie zamyka.
  await page.getByTestId('confirm-cancel').click();
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab')).toHaveCount(1);
  await page.locator('[data-testid=bottom-dock] .dock-tab .tab-close').click();
  await page.getByTestId('confirm-accept').click();
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab')).toHaveCount(0);

  expect(nativeDialogs).toBe(0);
  await app.close();
});
