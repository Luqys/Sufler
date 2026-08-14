import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
