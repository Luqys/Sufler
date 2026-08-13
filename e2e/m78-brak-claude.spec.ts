import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

/**
 * M78 — zgłoszenie z Windowsa: „Nie udało się uruchomić `claude`: File not found".
 * Nazwa komendy jest teraz rozwiązywana PRZED spawnem, więc jej brak kończy się
 * zdaniem, które mówi, co zrobić, a nie komunikatem z wnętrza node-pty.
 *
 * Sam Windows sprawdza się jednostkowo (tests/exec-path.test.ts) — tu chodzi
 * o ścieżkę błędu, wspólną dla obu systemów. PATH prowadzi w pustkę, a SHELL
 * w nieistniejący plik, żeby sonda logowanej powłoki nie przywróciła prawdziwego
 * PATH z plików rc.
 */
const BLIND_ENV = { PATH: '/nieistniejacy-katalog', SHELL: '/nieistniejacy-katalog/powloka' };

test('brak `claude` w PATH tłumaczy się po ludzku, a nie „File not found"', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), BLIND_ENV);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.getByTestId('claude-login-button').click();
  const dialog = page.getByTestId('login-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Nie znaleziono polecenia `claude`', { timeout: 15_000 });
  await expect(dialog).toContainText('npm i -g @anthropic-ai/claude-code');
  await expect(dialog).not.toContainText('File not found');

  await page.screenshot({ path: 'e2e-artifacts/m78-brak-claude.png' });
  await app.close();
});

test('brak powłoki w PATH też mówi wprost, czego szukać', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), BLIND_ENV);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.getByTestId('bottom-new-terminal').click();
  await expect(page.getByTestId('toast')).toContainText('Nie znaleziono powłoki', {
    timeout: 15_000,
  });

  await app.close();
});
