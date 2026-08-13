import { expect, test } from '@playwright/test';
import { createServer, type IncomingMessage } from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { formatLocalDate } from '../../src/shared/knowledge/obsidian-rest';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

function makeVault(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-vault-'));
  mkdirSync(join(dir, '.obsidian'));
  writeFileSync(join(dir, 'Beta.md'), '# Beta\n\nTreść bety.\n');
  return dir;
}

test('wikilinki w Monaco: [[Beta]] klikalne, nierozwiązane bez linku', async () => {
  const project = makeFixtureProject();
  const vault = makeVault();
  // Wikilinki działają w każdym .md — notatka projektu linkuje do vaulta.
  writeFileSync(
    join(project, 'Alfa.md'),
    '---\ntags: [test]\n---\n# Alfa\n\nZobacz [[Beta]] oraz [[Nieistniejąca notatka]].\n',
  );
  const app = await launchApp(makeConfigHome(), project, { VISUALN3O_VAULT: vault });
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  await tree.getByText('Alfa.md').click();
  await expect(page.getByTestId('tab-active')).toContainText('Alfa.md');

  // Frontmatter YAML zwinięty przy otwarciu (monaco-setup), treść widoczna.
  const viewLines = page.locator('.monaco-editor .view-lines');
  await expect(viewLines).toContainText('Alfa');
  await expect(viewLines).not.toContainText('tags:');

  // Provider linków rozwiązuje [[Beta]] (dekoracja detected-link), a
  // [[Nieistniejąca notatka]] zostaje zwykłym tekstem.
  const links = page.locator('.monaco-editor .detected-link');
  await expect(links).toHaveCount(1, { timeout: 10_000 });
  await expect(links.first()).toHaveText('Beta');
  await page.screenshot({ path: 'e2e-artifacts/m36-wikilinki.png' });

  // Cmd+klik otwiera cel w edytorze.
  await links.first().click({ modifiers: ['Meta'] });
  await expect(page.getByTestId('tab-active')).toContainText('Beta.md');

  await app.close();
});

test('zaznaczenie → PATCH pod nagłówek notatki dziennej (Local REST API)', async () => {
  const requests: Array<{
    method: string;
    url: string;
    headers: IncomingMessage['headers'];
    body: string;
  }> = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += String(chunk);
    });
    request.on('end', () => {
      requests.push({
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body,
      });
      response.writeHead(200);
      response.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  // Konfiguracja Obsidiana zapisana w state.json przed startem aplikacji.
  const configHome = makeConfigHome();
  mkdirSync(join(configHome, 'sufler'), { recursive: true });
  writeFileSync(
    join(configHome, 'sufler', 'state.json'),
    JSON.stringify({
      obsidian: {
        url: `http://127.0.0.1:${port}`,
        apiKey: 'sekret-e2e',
        dailyFile: 'Dziennik/{date}.md',
        dailyHeading: 'Wycinki',
      },
    }),
  );

  const project = makeFixtureProject();
  const app = await launchApp(configHome, project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  await tree.getByText('README.md').click();
  await expect(page.getByTestId('tab-active')).toContainText('README.md');
  await page.locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Meta+Shift+l');

  await expect(async () => {
    expect(requests.length).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  const received = requests[0]!;
  expect(received.method).toBe('PATCH');
  expect(received.url).toBe(`/vault/Dziennik/${formatLocalDate(new Date())}.md`);
  expect(received.headers['authorization']).toBe('Bearer sekret-e2e');
  expect(received.headers['operation']).toBe('append');
  expect(received.headers['target-type']).toBe('heading');
  expect(received.headers['target']).toBe('Wycinki');
  expect(received.body).toContain('# Projekt testowy');

  // Potwierdzenie w UI.
  await expect(page.locator('.toast-stack')).toContainText('Dopisano do notatki dziennej.');
  await page.screenshot({ path: 'e2e-artifacts/m36-notatka-dzienna.png' });

  await app.close();
  server.close();
});
