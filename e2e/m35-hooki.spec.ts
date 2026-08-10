import { expect, test } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from './utils';

async function lockInfo(configDir: string): Promise<{ port: number; token: string }> {
  const ideDir = join(configDir, 'ide');
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const first = readdirSync(ideDir).find((name) => name.endsWith('.lock'));
      if (first) {
        const lock = JSON.parse(readFileSync(join(ideDir, first), 'utf8')) as {
          authToken: string;
        };
        return { port: Number(first.replace('.lock', '')), token: lock.authToken };
      }
    } catch {
      // jeszcze nie ma
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('lock file serwera nie powstał');
}

function postHook(
  port: number,
  headers: Record<string, string>,
): Promise<number> {
  return fetch(`http://127.0.0.1:${port}/hook`, {
    method: 'POST',
    headers,
    body: '{"hook_event_name":"Notification"}',
  }).then((response) => response.status);
}

test('hooki Notification/Stop ustawiają status karty deterministycznie', async () => {
  const project = makeFixtureProject();
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: claudeConfig,
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();
  const { port, token } = await lockInfo(claudeConfig);

  // Karta claude (ptyId=1 — pierwszy proces tej instancji), potem terminal,
  // żeby karta claude przestała być aktywna (kropki widać tylko na nieaktywnych).
  await page.getByTestId('bottom-new-claude').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible();
  await page.getByTestId('bottom-new-terminal').click();
  const claudeTab = page.locator('[data-testid=bottom-dock] .dock-tab').first();

  // Zły token → 403 i status bez zmian.
  expect(
    await postHook(port, {
      'x-sufler-hook': 'obcy',
      'x-sufler-tab': '1',
      'x-sufler-event': 'notification',
    }),
  ).toBe(403);

  // Notification → niebieska kropka (czeka na zgodę).
  expect(
    await postHook(port, {
      'x-sufler-hook': token,
      'x-sufler-tab': '1',
      'x-sufler-event': 'notification',
    }),
  ).toBe(204);
  await expect(claudeTab).toHaveAttribute('data-status', 'needs-input');
  await expect(
    page.locator('[data-testid=bottom-dock] .status-dot.attention'),
  ).toBeVisible();

  // Stop → pomarańczowa kropka (skończył pracę).
  expect(
    await postHook(port, {
      'x-sufler-hook': token,
      'x-sufler-tab': '1',
      'x-sufler-event': 'stop',
    }),
  ).toBe(204);
  await expect(claudeTab).toHaveAttribute('data-status', 'idle');
  await expect(page.locator('[data-testid=bottom-dock] .status-dot.done')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m35-hooki.png' });

  await app.close();
});

test('karta claude dostaje --settings z hookami wskazującymi lokalny endpoint', async () => {
  const project = makeFixtureProject();
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  // Atrapa wypisująca argumenty (lokalna, żeby nie zmieniać wspólnego helpera).
  const binDir = mkdtempSync(join(tmpdir(), 'vn3o-bin-'));
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    join(binDir, 'claude'),
    '#!/bin/zsh\necho "ARGS: $@"\nwhile IFS= read -r line; do :; done\n',
    { mode: 0o755 },
  );
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: claudeConfig,
    VISUALN3O_PATH_PREPEND: binDir,
  });
  const page = await app.firstWindow();
  const { port, token } = await lockInfo(claudeConfig);

  await page.getByTestId('bottom-new-claude').click();
  const terminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(terminal).toContainText('ARGS: --settings', { timeout: 15_000 });

  // Plik hooków tej instancji (xterm zawija ścieżkę, więc szukamy w tmpdir):
  // port i token w treści jednoznacznie wiążą go z tym uruchomieniem.
  const candidates = readdirSync(tmpdir()).filter(
    (name) => name.startsWith('sufler-hooks-') && name.endsWith('.json'),
  );
  const matching = candidates.filter((name) => {
    try {
      const raw = readFileSync(join(tmpdir(), name), 'utf8');
      return raw.includes(`http://127.0.0.1:${port}/hook`) && raw.includes(token);
    } catch {
      return false;
    }
  });
  expect(matching).toHaveLength(1);
  const settings = JSON.parse(readFileSync(join(tmpdir(), matching[0]!), 'utf8')) as {
    hooks: { Notification: unknown[]; Stop: unknown[] };
  };
  expect(settings.hooks.Notification).toHaveLength(1);
  expect(settings.hooks.Stop).toHaveLength(1);

  await app.close();
});
