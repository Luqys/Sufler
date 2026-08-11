import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

import type { ImportPathsResult } from '../src/shared/ipc';

/** window.api w evaluate — wąski wycinek WindowApi używany przez test. */
interface ImportApiWindow {
  api: {
    importPaths(root: string, destDir: string, sources: string[]): Promise<ImportPathsResult>;
  };
}

test('upuszczone foldery i pliki lądują w projekcie, kolizje dostają sufiks', async () => {
  const project = makeFixtureProject();
  const desktop = mkdtempSync(join(tmpdir(), 'vn3o-pulpit-'));
  mkdirSync(join(desktop, 'materialy'));
  writeFileSync(join(desktop, 'materialy', 'notatka.md'), '# Notatka z pulpitu\n');
  writeFileSync(join(desktop, 'raport.txt'), 'raport\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');
  await tree.getByText('README.md').waitFor();

  // Folder z zawartością + plik — jak upuszczenie dwóch elementów z Findera.
  const first = await page.evaluate(
    ([root, dir, file]) =>
      (window as unknown as ImportApiWindow).api.importPaths(root, root, [dir, file]),
    [project, join(desktop, 'materialy'), join(desktop, 'raport.txt')] as const,
  );
  expect(first).toEqual({ ok: true, copied: 2, skipped: [] });
  expect(readFileSync(join(project, 'materialy', 'notatka.md'), 'utf8')).toContain(
    'Notatka z pulpitu',
  );

  await page.getByTestId('refresh-tree').click();
  await expect(tree.getByText('materialy')).toBeVisible();
  await expect(tree.getByText('raport.txt')).toBeVisible();

  // Druga tura z tym samym plikiem — kolizja rozwiązana sufiksem, bez nadpisania.
  const second = await page.evaluate(
    ([root, file]) =>
      (window as unknown as ImportApiWindow).api.importPaths(root, root, [file]),
    [project, join(desktop, 'raport.txt')] as const,
  );
  expect(second).toEqual({ ok: true, copied: 1, skipped: [] });
  expect(existsSync(join(project, 'raport-2.txt'))).toBe(true);

  // Źródło wewnątrz projektu jest odrzucane — nic się nie kopiuje.
  const inside = await page.evaluate(
    ([root, file]) =>
      (window as unknown as ImportApiWindow).api.importPaths(root, root, [file]),
    [project, join(project, 'README.md')] as const,
  );
  expect(inside.ok).toBe(true);
  if (inside.ok) {
    expect(inside.copied).toBe(0);
    expect(inside.skipped).toEqual([{ name: 'README.md', reason: 'inside-project' }]);
  }

  // Cel poza projektem — twarda odmowa.
  const outside = await page.evaluate(
    ([root, dest, file]) =>
      (window as unknown as ImportApiWindow).api.importPaths(root, dest, [file]),
    [project, desktop, join(desktop, 'raport.txt')] as const,
  );
  expect(outside).toEqual({ ok: false, error: 'dest-outside-project' });

  await page.getByTestId('refresh-tree').click();
  await expect(tree.getByText('raport-2.txt')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m61-import.png' });
  await app.close();
});
