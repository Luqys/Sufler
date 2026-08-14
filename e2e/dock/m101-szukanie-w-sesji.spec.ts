/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('skoki na koniec i początek sesji oraz szukanie frazy w buforze', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  const dock = page.locator('[data-testid=bottom-dock]');
  await expect(dock.locator('.xterm')).toBeVisible();

  // Bufor dłuższy niż ekran: 200 numerowanych wierszy plus jedna igła.
  // Czekamy na znak zachęty — wpisanie polecenia przed nim gubi początek.
  await expect(dock.locator('.xterm')).toContainText('vn3o-proj-', { timeout: 15_000 });
  await dock.locator('.xterm').click();
  await page.keyboard.type('for i in $(seq 1 200); do echo "wiersz $i"; done; echo IGLA-SZUKANA');
  await page.keyboard.press('Enter');
  await expect(dock.locator('.xterm')).toContainText('IGLA-SZUKANA', { timeout: 15_000 });

  // Widoczny jest ogon bufora — początek wyjechał poza ekran.
  const ekran = dock.locator('.xterm-screen');
  await expect(ekran).toContainText('wiersz 200');

  // Skok na początek: widać pierwsze wiersze, ostatnie zniknęły z ekranu.
  await page.getByTestId('bottom-scroll-top').click();
  await expect(ekran).toContainText('wiersz 2');
  await expect(ekran).not.toContainText('wiersz 200');
  await page.getByTestId('bottom-scroll-bottom').click();
  await expect(ekran).toContainText('wiersz 200');

  // Szukajka: Cmd+F z klawiatury terminala.
  await dock.locator('.xterm').click();
  await page.keyboard.press('Meta+f');
  const szukajka = page.getByTestId('terminal-search');
  await expect(szukajka).toBeVisible();

  await page.getByTestId('terminal-search-input').fill('wiersz 7');
  // „wiersz 7", „wiersz 70"…„wiersz 79" — jedenaście trafień, ostatnie na starcie.
  await expect(page.getByTestId('terminal-search-count')).toHaveText('11 z 11');

  // Trafienie wypada w widocznym oknie, a nie gdzieś w niewidocznym buforze.
  await page.getByTestId('terminal-search-prev').click();
  await expect(page.getByTestId('terminal-search-count')).toHaveText('10 z 11');
  await expect(ekran).toContainText('wiersz 78');
  // Trafienie jest zaznaczone — widać je w warstwie zaznaczenia xterma.
  await expect(dock.locator('.xterm-selection div').first()).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m101-szukanie-w-sesji.png' });

  // Fraza spoza bufora mówi to wprost.
  await page.getByTestId('terminal-search-input').fill('czegoś takiego nie ma');
  await expect(page.getByTestId('terminal-search-count')).toHaveText('brak trafień');
  await expect(page.getByTestId('terminal-search-next')).toBeDisabled();

  // Escape zamyka i oddaje klawiaturę terminalowi.
  await page.getByTestId('terminal-search-input').press('Escape');
  await expect(szukajka).toHaveCount(0);
  await page.keyboard.type('echo po-zamknieciu');
  await page.keyboard.press('Enter');
  await expect(dock.locator('.xterm')).toContainText('po-zamknieciu', { timeout: 15_000 });

  await app.close();
});
