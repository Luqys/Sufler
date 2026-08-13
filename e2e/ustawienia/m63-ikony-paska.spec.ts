import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('ikony paska tytułu mają jednakowy rozmiar i rysunek wektorowy', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  const ids = ['settings-button', 'help-button', 'claude-login-button'];
  for (const id of ids) {
    // Żadna z ikon nie jest już znakiem tekstowym — wszystkie to SVG.
    const svg = page.getByTestId(id).locator('svg');
    await expect(svg).toHaveCount(1);
    const box = await svg.boundingBox();
    expect(box?.width).toBeCloseTo(15, 0);
    expect(box?.height).toBeCloseTo(15, 0);
  }

  // Przyciski paska mają wspólną wysokość — łącznie z przełącznikami paneli.
  const heights = await page
    .locator('.titlebar-actions .titlebar-btn')
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
  expect(new Set(heights).size).toBe(1);

  await page.screenshot({ path: 'e2e-artifacts/m63-ikony-paska.png', clip: { x: 940, y: 6, width: 340, height: 28 } });
  await app.close();
});
