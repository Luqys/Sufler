import { expect, test, type Page } from '@playwright/test';
import {
  decodePng,
  extremeContrast,
  launchApp,
  makeConfigHome,
  makeConfigHomeWithMode,
  makeFixtureProject,
} from './utils';

/**
 * M75 — lewy pasek ikon: większe cele, czytelniejsze ikony, widoczny stan
 * aktywny. Widoczność sprawdzamy na FAKTYCZNYCH pikselach zrzutu, bo o niej
 * decyduje złożenie przezroczystego koloru z tłem, a nie deklaracja CSS.
 */

/** Kontrast ikony do tła w obrębie jednego przycisku paska. */
async function iconContrast(page: Page, testId: string): Promise<number> {
  const button = page.getByTestId(testId);
  const box = await button.boundingBox();
  if (!box) {
    throw new Error(`przycisk ${testId} bez geometrii`);
  }
  const shot = await page.screenshot({ clip: box });
  return extremeContrast(decodePng(shot));
}

test('pasek ikon ma jedną powiększoną metrykę i pigułkę przy aktywnym panelu', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  // Wszystkie ikony paska w jednym, powiększonym rozmiarze (było 17 px).
  const iconSizes = await page
    .locator('.icon-rail .rail-btn svg')
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
  expect(iconSizes).toHaveLength(7);
  expect([...new Set(iconSizes)]).toEqual([22]);

  // Cel kliknięcia nie mniejszy niż 40 px w obu wymiarach (było 32 px).
  const targets = await page.locator('.icon-rail .rail-btn').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    }),
  );
  for (const target of targets) {
    expect(target.width).toBeGreaterThanOrEqual(40);
    expect(target.height).toBeGreaterThanOrEqual(40);
  }

  const markerOf = (id: string): Promise<{ content: string; width: string }> =>
    page.getByTestId(id).evaluate((node) => {
      const style = getComputedStyle(node, '::before');
      return { content: style.content, width: style.width };
    });

  // Otwarty panel poznaje się po pigułce przy krawędzi, nie tylko po kolorze ikony.
  const filesMarker = await markerOf('rail-files');
  expect(filesMarker.content).not.toBe('none');
  expect(filesMarker.width).toBe('3px');
  expect((await markerOf('rail-git')).content).toBe('none');

  // Przełączenie panelu przenosi pigułkę na nową ikonę.
  await page.getByTestId('rail-git').click();
  await expect(page.getByTestId('rail-git')).toHaveClass(/active/);
  expect((await markerOf('rail-git')).width).toBe('3px');
  expect((await markerOf('rail-files')).content).toBe('none');

  await app.close();
});

for (const mode of ['light', 'dark'] as const) {
  test(`ikony paska są czytelne w motywie ${mode === 'dark' ? 'ciemnym' : 'jasnym'}`, async () => {
    // Motyw z zapisanego stanu — renderer barwi się od startu (M58), bez
    // wyścigu z watcherem prefers-color-scheme.
    const app = await launchApp(makeConfigHomeWithMode(mode), makeFixtureProject());
    const page = await app.firstWindow();
    await expect(page.getByTestId('workbench')).toBeVisible();
    await expect(page.locator(`html[data-theme=${mode}]`)).toHaveCount(1);

    // Próg 3:1 — tyle WCAG wymaga od elementów graficznych interfejsu.
    // Przed M75 ikony siedziały na --muted i w ciemnym motywie ledwo
    // odcinały się od tła paska.
    const idle = await iconContrast(page, 'rail-search');
    expect(idle).toBeGreaterThanOrEqual(3);

    const active = await iconContrast(page, 'rail-files');
    expect(active).toBeGreaterThanOrEqual(3);

    await page.screenshot({
      path: `e2e-artifacts/m75-pasek-ikon-${mode === 'dark' ? 'ciemny' : 'jasny'}.png`,
      clip: { x: 0, y: 40, width: 300, height: 420 },
    });
    await app.close();
  });
}
