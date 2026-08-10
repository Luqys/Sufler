import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

function makeVault(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-vault-'));
  mkdirSync(join(dir, '.obsidian'));
  writeFileSync(join(dir, '.obsidian', 'app.json'), '{}');
  mkdirSync(join(dir, '.trash'));
  writeFileSync(join(dir, '.trash', 'stara.md'), 'kosz\n');
  writeFileSync(
    join(dir, 'Dziennik.md'),
    '---\ntags: [dziennik, test]\nutworzono: 2026-08-10\n---\n# Notatka dzienna\n\nTreść notatki.\n',
  );
  writeFileSync(join(dir, 'Pomysły.md'), '# Pomysły\n');
  return dir;
}

/** Atrapa claude z serwerem obsidian w stanie błędu (Obsidian zamknięty). */
function makeFakeClaudeObsidianBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-obsbin-'));
  const script = [
    '#!/bin/zsh',
    'if [[ "$1" == "mcp" && "$2" == "list" ]]; then',
    "  echo 'Checking MCP server health…'",
    "  echo ''",
    "  echo 'obsidian: http://127.0.0.1:27123/mcp/ (HTTP) - ✘ Failed to connect — ConnectionRefused: odmowa'",
    '  exit 0',
    'fi',
    'exit 1',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

test('vault jako drugi korzeń: ukryte .obsidian/.trash, edycja i zapis notatki', async () => {
  const project = makeFixtureProject();
  const vault = makeVault();
  const app = await launchApp(makeConfigHome(), project, { VISUALN3O_VAULT: vault });
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  // Drugi korzeń z etykietą „Notatki" i plikami vaulta, bez katalogów Obsidiana.
  await expect(page.getByTestId('vault-root-header')).toBeVisible();
  await expect(tree.getByText('Dziennik.md')).toBeVisible();
  await expect(tree.getByText('Pomysły.md')).toBeVisible();
  await expect(tree.getByText('.obsidian')).toHaveCount(0);
  await expect(tree.getByText('.trash')).toHaveCount(0);

  // Otwarcie notatki: frontmatter zwinięty (tags niewidoczne), treść widoczna.
  await tree.getByText('Dziennik.md').click();
  await expect(page.getByTestId('tab-active')).toContainText('Dziennik.md');
  const viewLines = page.locator('.monaco-editor .view-lines');
  await expect(viewLines).toContainText('Notatka dzienna');
  await expect(viewLines).not.toContainText('tags:');

  // Edycja i zapis notatki — Obsidian podchwyci zmianę z dysku.
  await viewLines.click();
  await page.keyboard.press('Meta+ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.type('Dopisek z Suflera.');
  await page.keyboard.press('Meta+s');
  await expect
    .poll(() => readFileSync(join(vault, 'Dziennik.md'), 'utf8'))
    .toContain('Dopisek z Suflera.');
  await expect
    .poll(() => readFileSync(join(vault, 'Dziennik.md'), 'utf8'))
    .toContain('tags: [dziennik, test]');

  await page.screenshot({ path: 'e2e-artifacts/m8-vault-notatka.png' });
  await app.close();
});

test('dodawanie i odpinanie vaulta oraz podpowiedź „Uruchom Obsidiana" w MCP', async () => {
  const project = makeFixtureProject();
  const home = mkdtempSync(join(tmpdir(), 'vn3o-home-'));
  writeFileSync(
    join(home, '.claude.json'),
    JSON.stringify({
      mcpServers: { obsidian: { type: 'http', url: 'http://127.0.0.1:27123/mcp/' } },
    }),
  );
  const app = await launchApp(makeConfigHome(), project, {
    HOME: home,
    VISUALN3O_PATH_PREPEND: makeFakeClaudeObsidianBin(),
  });
  const page = await app.firstWindow();

  // Bez vaulta: przycisk dodania widoczny.
  await expect(page.getByTestId('vault-add')).toBeVisible();

  // Panel MCP: serwer obsidian w stanie błędu → podpowiedź o uruchomieniu Obsidiana.
  await page.getByTestId('rail-mcp').click();
  const obsidianRow = page.locator('.mcp-server', { hasText: 'obsidian' });
  await expect(obsidianRow).toHaveAttribute('data-state', 'error', { timeout: 15_000 });
  await expect(page.getByTestId('obsidian-hint')).toBeVisible();
  await expect(page.getByTestId('obsidian-hint')).toContainText('uruchom Obsidiana');

  await page.screenshot({ path: 'e2e-artifacts/m8-obsidian-hint.png' });
  await app.close();
});
