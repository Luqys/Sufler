import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

/**
 * M79 — dodawanie serwera MCP z aplikacji. Atrapa `claude` zapisuje argumenty
 * `mcp add` do pliku i od tej chwili wypisuje serwer w `mcp list`, więc test
 * przechodzi pełną drogę: kreator → CLI → panel.
 */
function makeRecordingClaudeBin(): { dir: string; log: string; state: string } {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-mcpadd-'));
  const log = join(dir, 'wywolania.txt');
  const state = join(dir, 'dodane.txt');
  const script = [
    '#!/bin/zsh',
    `if [[ "$1" == "mcp" && "$2" == "add" ]]; then`,
    `  print -r -- "$@" >> ${log}`,
    // Nazwa serwera to pierwszy argument po „add", z pominięciem flag transportu.
    '  if [[ "$3" == "--transport" ]]; then nazwa="$5"; else nazwa="$3"; fi',
    `  print -r -- "\${nazwa}: http://localhost:9/mcp (HTTP) - ✔ Connected" >> ${state}`,
    '  echo "Added MCP server ${nazwa}"',
    '  exit 0',
    'fi',
    'if [[ "$1" == "mcp" && "$2" == "list" ]]; then',
    "  echo 'Checking MCP server health…'",
    `  [[ -f ${state} ]] && cat ${state}`,
    '  exit 0',
    'fi',
    'exit 1',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return { dir, log, state };
}

test('kreator MCP zapisuje serwer przez `claude mcp add` i pokazuje go w panelu', async () => {
  const fake = makeRecordingClaudeBin();
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: fake.dir,
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-mcp').click();
  await expect(page.getByTestId('mcp-panel')).toBeVisible();

  await page.getByTestId('mcp-add').click();
  const dialog = page.getByTestId('mcp-create-dialog');
  await expect(dialog).toBeVisible();

  // Nazwa ze spacją nie przejdzie — przycisk zostaje zablokowany.
  await page.getByTestId('mcp-create-name').fill('moj serwer');
  await expect(page.getByTestId('mcp-create-submit')).toBeDisabled();

  await page.getByTestId('mcp-create-name').fill('supabase');
  // Adres bez schematu też nie.
  await page.getByTestId('mcp-create-url').fill('mcp.supabase.com');
  await expect(page.getByTestId('mcp-create-submit')).toBeDisabled();

  await page.getByTestId('mcp-create-url').fill('https://mcp.supabase.com/mcp');
  await page.getByTestId('mcp-create-headers').fill('Authorization: Bearer tajne');
  await page.getByTestId('mcp-create-submit').click();

  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId('toast')).toContainText('supabase');

  // CLI dostało dokładnie te argumenty, których oczekujemy.
  await expect.poll(() => existsSync(fake.log), { timeout: 10_000 }).toBe(true);
  const wywolanie = readFileSync(fake.log, 'utf8').trim();
  expect(wywolanie).toContain('mcp add --transport http supabase https://mcp.supabase.com/mcp');
  expect(wywolanie).toContain('-s project');
  expect(wywolanie).toContain('-H Authorization: Bearer tajne');

  // Panel widzi nowy serwer bez ręcznego odświeżania.
  await expect(page.getByTestId('mcp-panel')).toContainText('supabase', { timeout: 15_000 });

  await page.screenshot({ path: 'e2e-artifacts/m79-dodaj-mcp.png' });
  await app.close();
});

test('serwer stdio: komenda idzie po `--`, bez adresu i nagłówków', async () => {
  const fake = makeRecordingClaudeBin();
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: fake.dir,
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-mcp').click();
  await page.getByTestId('mcp-add').click();
  await page.getByTestId('mcp-create-name').fill('lokalny');
  await page.getByTestId('mcp-create-transport-stdio').click();

  // Transport lokalny nie ma pól adresu ani nagłówków.
  await expect(page.getByTestId('mcp-create-url')).toHaveCount(0);
  await expect(page.getByTestId('mcp-create-headers')).toHaveCount(0);

  await page.getByTestId('mcp-create-command').fill('npx -y @scope/serwer --port 3000');
  await page.getByTestId('mcp-create-scope').selectOption('user');
  await page.getByTestId('mcp-create-submit').click();

  await expect(page.getByTestId('mcp-create-dialog')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => existsSync(fake.log), { timeout: 10_000 }).toBe(true);
  const wywolanie = readFileSync(fake.log, 'utf8').trim();
  expect(wywolanie).toContain('mcp add lokalny -s user -- npx -y @scope/serwer --port 3000');

  await app.close();
});
