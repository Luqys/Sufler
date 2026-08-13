import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome } from './utils';

/**
 * M76 — ekran startowy tworzy folder roboczy. Wcześniej dawał tylko „Otwórz
 * folder…", więc nowy projekt trzeba było założyć w Finderze i wrócić.
 *
 * Lokalizacja bierze się z „Ostatnich" (katalog obok ostatniego projektu),
 * dzięki czemu test nie tyka katalogu domowego, a natywny dialog wyboru
 * miejsca nie jest w ogóle potrzebny.
 */
function configWithRecent(recent: string): string {
  const dir = makeConfigHome();
  mkdirSync(join(dir, 'sufler'), { recursive: true });
  writeFileSync(
    join(dir, 'sufler', 'state.json'),
    JSON.stringify({ recentRoots: [recent] }, null, 2),
  );
  return dir;
}

/** Istniejący projekt w tymczasowym katalogu — jego rodzic to miejsce na nowy. */
function makeParentWithProject(): { parent: string; project: string } {
  const parent = mkdtempSync(join(tmpdir(), 'vn3o-rodzic-'));
  const project = join(parent, 'stary-projekt');
  mkdirSync(project);
  writeFileSync(join(project, 'README.md'), '# stary\n');
  return { parent, project };
}

test('ekran startowy zakłada nowy folder roboczy z repozytorium git', async () => {
  const { parent, project } = makeParentWithProject();
  const app = await launchApp(configWithRecent(project));
  const page = await app.firstWindow();
  await expect(page.getByTestId('welcome')).toBeVisible();

  // Dwie równorzędne drogi: nowy projekt i otwarcie istniejącego.
  await expect(page.getByTestId('welcome-new')).toBeVisible();
  await expect(page.getByTestId('welcome-open')).toBeVisible();

  await page.getByTestId('welcome-new').click();
  const form = page.getByTestId('welcome-new-form');
  await expect(form).toBeVisible();
  // Lokalizacja podpowiedziana z „Ostatnich" — bez dialogu systemowego.
  await expect(page.getByTestId('welcome-new-parent')).toHaveValue(parent);

  // Nazwa z ukośnikiem nie przechodzi, a przycisk zostaje zablokowany.
  await page.getByTestId('welcome-new-name').fill('zly/pomysl');
  await expect(page.getByTestId('welcome-new-submit')).toBeDisabled();

  await page.getByTestId('welcome-new-name').fill('nowy-sklep');
  // Podgląd pokazuje pełną ścieżkę, zanim cokolwiek powstanie.
  await expect(page.getByTestId('welcome-new-preview')).toContainText(
    join(parent, 'nowy-sklep'),
  );
  await page.screenshot({ path: 'e2e-artifacts/m76-ekran-startowy.png' });

  await page.getByTestId('welcome-new-submit').click();

  // Ekran startowy ustępuje warsztatowi, a drzewo pokazuje nowy projekt.
  await expect(page.getByTestId('workbench')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('file-tree')).toContainText('README.md');

  const target = join(parent, 'nowy-sklep');
  expect(existsSync(join(target, '.git'))).toBe(true);
  // Pierwszy commit istnieje — bez niego punkty przywracania nie mają kotwicy.
  const log = execFileSync('git', ['log', '--oneline'], { cwd: target, encoding: 'utf8' });
  expect(log).toContain('Początek projektu');

  await page.screenshot({ path: 'e2e-artifacts/m76-nowy-projekt.png' });
  await app.close();
});

test('nowy projekt bez repozytorium; istniejąca nazwa daje czytelny błąd', async () => {
  const { parent, project } = makeParentWithProject();
  const app = await launchApp(configWithRecent(project));
  const page = await app.firstWindow();
  await page.getByTestId('welcome-new').click();

  // Nazwa zajęta przez folder, który już jest na dysku.
  await page.getByTestId('welcome-new-name').fill('stary-projekt');
  await page.getByTestId('welcome-new-submit').click();
  await expect(page.getByTestId('welcome-new-error')).toContainText('już istnieje');
  await expect(page.getByTestId('welcome')).toBeVisible();

  // Bez gita: folder powstaje, ale bez repozytorium.
  await page.getByTestId('welcome-new-git').uncheck();
  await page.getByTestId('welcome-new-name').fill('bez-gita');
  await page.getByTestId('welcome-new-submit').click();

  await expect(page.getByTestId('workbench')).toBeVisible({ timeout: 15_000 });
  const target = join(parent, 'bez-gita');
  expect(existsSync(target)).toBe(true);
  expect(existsSync(join(target, '.git'))).toBe(false);

  await app.close();
});
