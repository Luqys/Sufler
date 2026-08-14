/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Przesunięcie gałki suwaka w poziomie — po nim poznajemy stronę suwaka. */
function knobX(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const knob = document.querySelector('.theme-slider-knob');
    return knob ? Math.round(knob.getBoundingClientRect().left) : -1;
  });
}

test('M106: suwak motywu przesuwa gałkę, a pasek tytułu ma pogrupowane przyciski', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  // Motyw czytamy z systemu (jak M15) — wymuszony colorScheme zamroziłby
  // zapytanie mediów i przełącznik nie miałby jak się w nim odbić.
  await page.emulateMedia({ colorScheme: null });
  await expect(page.getByTestId('workbench')).toBeVisible();

  const ciemny = (): Promise<boolean> =>
    page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const naStarcie = await ciemny();

  const suwak = page.getByTestId('theme-quick-toggle');
  await expect(suwak).toHaveAttribute('role', 'switch');
  await expect(suwak).toHaveAttribute('aria-checked', String(naStarcie));
  const pozycjaStartowa = await knobX(page);
  await page.screenshot({ path: 'e2e-artifacts/m106-pasek-start.png' });

  // Klik przesuwa gałkę na drugą stronę toru i odwraca motyw.
  await suwak.click();
  await expect(suwak).toHaveAttribute('aria-checked', String(!naStarcie));
  await expect.poll(ciemny).toBe(!naStarcie);
  await expect
    .poll(async () => Math.abs((await knobX(page)) - pozycjaStartowa))
    .toBeGreaterThan(15);
  await page.screenshot({ path: 'e2e-artifacts/m106-pasek-po-przelaczeniu.png' });

  // Powrót — gałka wraca na start.
  await suwak.click();
  await expect.poll(() => knobX(page)).toBe(pozycjaStartowa);

  /*
   * Pasek tytułu: dwie grupy przycisków (akcje aplikacji i szyby układu),
   * rozdzielone suwakiem. Odstęp między grupami jest większy niż wewnątrz
   * grupy — inaczej wszystko czytałoby się jako jeden ciąg ikon.
   */
  const grupy = page.locator('.titlebar-group');
  await expect(grupy).toHaveCount(2);
  const wewnatrz = await page.evaluate(() => {
    const ustawienia = document.querySelector('[data-testid=settings-button]')!.getBoundingClientRect();
    const pomoc = document.querySelector('[data-testid=help-button]')!.getBoundingClientRect();
    return Math.round(pomoc.left - ustawienia.right);
  });
  const miedzy = await page.evaluate(() => {
    const claude = document.querySelector('[data-testid=claude-login-button]')!.getBoundingClientRect();
    const suwakEl = document.querySelector('.theme-slider')!.getBoundingClientRect();
    return Math.round(suwakEl.left - claude.right);
  });
  expect(miedzy).toBeGreaterThan(wewnatrz);

  await app.close();
});
