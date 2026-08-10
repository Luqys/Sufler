import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ElectronApplication, type Page } from 'playwright';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

const DEFAULTS = { sidebarWidth: 240, rightDockWidth: 360, bottomDockHeight: 220 };
const AREAS = ['sidebar', 'editor', 'bottom-dock', 'right-dock'] as const;

async function openWorkbench(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();
  return page;
}

async function panelSize(page: Page, testId: string): Promise<{ width: number; height: number }> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) {
    throw new Error(`Panel ${testId} jest niewidoczny`);
  }
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

async function dragSplitter(page: Page, testId: string, dx: number, dy: number): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) {
    throw new Error(`Splitter ${testId} jest niewidoczny`);
  }
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 8 });
  await page.mouse.up();
}

/**
 * Przeciąga aż do celu z korektą (syntetyczne drag potrafi zgubić końcówkę
 * ruchu przy równoległych renderach) — jak człowiek poprawiający chwyt.
 * sign: znak przesunięcia zwiększającego wymiar (sidebar +1, prawy/dolny -1).
 */
async function dragUntil(
  page: Page,
  splitterId: string,
  panelId: string,
  dim: 'width' | 'height',
  target: number,
  sign: 1 | -1,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const size = (await panelSize(page, panelId))[dim];
    const delta = target - size;
    if (Math.abs(delta) <= 1) {
      return;
    }
    await dragSplitter(
      page,
      splitterId,
      dim === 'width' ? delta * sign : 0,
      dim === 'height' ? delta * sign : 0,
    );
  }
}

function readLayoutFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

test('okno otwiera się z czterema obszarami układu i domyślnymi rozmiarami', async () => {
  const configHome = makeConfigHome();
  const app = await launchApp(configHome, makeFixtureProject());
  const page = await openWorkbench(app);

  for (const area of AREAS) {
    await expect(page.getByTestId(area)).toBeVisible();
  }

  expect((await panelSize(page, 'sidebar')).width).toBe(DEFAULTS.sidebarWidth);
  expect((await panelSize(page, 'right-dock')).width).toBe(DEFAULTS.rightDockWidth);
  expect((await panelSize(page, 'bottom-dock')).height).toBe(DEFAULTS.bottomDockHeight);

  await app.close();
});

test('rozmiary paneli po przeciągnięciu splitterów przeżywają restart aplikacji', async () => {
  const configHome = makeConfigHome();
  const project = makeFixtureProject();
  const layoutFile = join(configHome, 'sufler', 'layout.json');

  let app = await launchApp(configHome, project);
  let page = await openWorkbench(app);
  // Stabilizacja przed przeciąganiem: drzewo wczytane, asynchroniczne
  // renderowania (git status) za nami.
  await expect(page.getByTestId('file-tree').getByText('README.md')).toBeVisible();

  await dragUntil(page, 'splitter-sidebar', 'sidebar', 'width', 320, 1); // 240 -> 320
  await dragUntil(page, 'splitter-right', 'right-dock', 'width', 430, -1); // 360 -> 430
  await dragUntil(page, 'splitter-bottom', 'bottom-dock', 'height', 280, -1); // 220 -> 280

  expect((await panelSize(page, 'sidebar')).width).toBe(320);
  expect((await panelSize(page, 'right-dock')).width).toBe(430);
  expect((await panelSize(page, 'bottom-dock')).height).toBe(280);

  await expect
    .poll(() => readLayoutFile(layoutFile), { timeout: 10_000 })
    .toEqual({
      version: 1,
      sidebarWidth: 320,
      rightDockWidth: 430,
      bottomDockHeight: 280,
      sidebarVisible: true,
      rightDockVisible: true,
      bottomDockVisible: true,
    });

  await page.screenshot({ path: 'e2e-artifacts/m0-po-zmianie-rozmiarow.png' });
  await app.close();

  app = await launchApp(configHome, project);
  page = await openWorkbench(app);

  expect((await panelSize(page, 'sidebar')).width).toBe(320);
  expect((await panelSize(page, 'right-dock')).width).toBe(430);
  expect((await panelSize(page, 'bottom-dock')).height).toBe(280);

  await page.screenshot({ path: 'e2e-artifacts/m0-po-restarcie.png' });
  await app.close();
});
