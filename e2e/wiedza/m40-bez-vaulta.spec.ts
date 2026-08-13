import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

function makeVault(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-vault-'));
  mkdirSync(join(dir, '.obsidian'));
  writeFileSync(join(dir, 'Dziennik.md'), '# Dziennik\n');
  return dir;
}

test('drzewo bez vaulta: skonfigurowany vault nie pojawia się ani w drzewie, ani w Ustawieniach', async () => {
  const project = makeFixtureProject();
  const vault = makeVault();
  const app = await launchApp(makeConfigHome(), project, { VISUALN3O_VAULT: vault });
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  // Drzewo pokazuje wyłącznie projekt — bez drugiego korzenia i bez linku dodawania.
  await expect(tree.getByText('README.md')).toBeVisible();
  await expect(page.getByTestId('vault-root-header')).toHaveCount(0);
  await expect(page.getByTestId('vault-add')).toHaveCount(0);
  await expect(tree.getByText('Dziennik.md')).toHaveCount(0);

  // Od M47 vault zniknął także z Ustawień — Obsidian został przy notatce dziennej.
  await page.keyboard.press('Meta+Comma');
  const dialog = page.getByTestId('settings-view');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('Vault Obsidiana');
  await expect(dialog).toContainText('Obsidian — notatka dzienna');

  await page.screenshot({ path: 'e2e-artifacts/m40-bez-vaulta.png' });
  await app.close();
});
