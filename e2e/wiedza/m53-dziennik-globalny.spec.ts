import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('dziennik poza Suflerem: instalacja skryptu i hooków w ~/.claude bez ruszania cudzych', async () => {
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  // Istniejące ustawienia użytkownika — instalacja ma je uszanować.
  writeFileSync(
    join(claudeConfig, 'settings.json'),
    `${JSON.stringify({ model: 'opus', hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo cudzy' }] }] } }, null, 2)}\n`,
  );

  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    CLAUDE_CONFIG_DIR: claudeConfig,
  });
  const page = await app.firstWindow();

  await page.getByTestId('settings-button').click();
  const toggle = page.getByTestId('session-log-global-toggle');
  await expect(toggle).not.toBeChecked();

  await toggle.click();
  await expect(toggle).toBeChecked();

  const script = join(claudeConfig, 'sufler-dziennik.mjs');
  await expect.poll(() => existsSync(script), { timeout: 10_000 }).toBe(true);
  expect(readFileSync(script, 'utf8')).toContain('dziennik-sesji');

  const settings = JSON.parse(readFileSync(join(claudeConfig, 'settings.json'), 'utf8')) as {
    model?: string;
    hooks?: Record<string, unknown[]>;
  };
  expect(settings.model).toBe('opus');
  expect(JSON.stringify(settings.hooks?.SessionStart)).toContain('echo cudzy');
  expect(JSON.stringify(settings.hooks?.UserPromptSubmit)).toContain('sufler-dziennik.mjs');
  expect(JSON.stringify(settings.hooks?.PostToolUse)).toContain('tool');
  await page.screenshot({ path: 'e2e-artifacts/m53-dziennik-globalny.png' });

  // Wyłączenie sprząta nasze wpisy, cudzy hook zostaje.
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect
    .poll(() => {
      const raw = JSON.parse(readFileSync(join(claudeConfig, 'settings.json'), 'utf8')) as {
        hooks?: Record<string, unknown[]>;
      };
      return JSON.stringify(raw.hooks ?? {});
    })
    .not.toContain('sufler-dziennik.mjs');
  const after = JSON.parse(readFileSync(join(claudeConfig, 'settings.json'), 'utf8')) as {
    hooks?: Record<string, unknown[]>;
  };
  expect(JSON.stringify(after.hooks?.SessionStart)).toContain('echo cudzy');

  await app.close();
});

test('przyciski paska tytułu są wygodne w kliknięciu (min. 30 px)', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  for (const id of ['settings-button', 'help-button']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(30);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(28);
  }

  await app.close();
});
