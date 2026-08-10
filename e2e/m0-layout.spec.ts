import { expect, test } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

const DEFAULTS = { sidebarWidth: 240, rightDockWidth: 360, bottomDockHeight: 220 };
const AREAS = ['sidebar', 'editor', 'bottom-dock', 'right-dock'] as const;

function launchApp(configHome: string): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env['XDG_CONFIG_HOME'] = configHome;
  delete env['ELECTRON_RENDERER_URL'];
  return electron.launch({ args: ['.'], env });
}

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

function readLayoutFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

test('okno otwiera się z czterema obszarami układu i domyślnymi rozmiarami', async () => {
  const configHome = mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
  const app = await launchApp(configHome);
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
  const configHome = mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
  const layoutFile = join(configHome, 'visualn3o', 'layout.json');

  let app = await launchApp(configHome);
  let page = await openWorkbench(app);

  await dragSplitter(page, 'splitter-sidebar', 80, 0); // 240 -> 320
  await dragSplitter(page, 'splitter-right', -70, 0); // 360 -> 430
  await dragSplitter(page, 'splitter-bottom', 0, -60); // 220 -> 280

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

  app = await launchApp(configHome);
  page = await openWorkbench(app);

  expect((await panelSize(page, 'sidebar')).width).toBe(320);
  expect((await panelSize(page, 'right-dock')).width).toBe(430);
  expect((await panelSize(page, 'bottom-dock')).height).toBe(280);

  await page.screenshot({ path: 'e2e-artifacts/m0-po-restarcie.png' });
  await app.close();
});
