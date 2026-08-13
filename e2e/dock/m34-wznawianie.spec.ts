import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSlug } from '../../src/shared/claude/claude-sessions';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Atrapa `claude`, która wypisuje otrzymane argumenty — do asercji --resume. */
function makeArgEchoClaudeBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-bin-'));
  const script = `#!/bin/zsh
echo "ARGS: $@"
echo "? for shortcuts"
while IFS= read -r line; do :; done
`;
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

const wpis = (obj: object): string => JSON.stringify(obj);

test('menu Wznów sesję listuje zapisane sesje i startuje claude --resume', async () => {
  const project = makeFixtureProject();
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const sessionsDir = join(claudeConfig, 'projects', projectSlug(project));
  mkdirSync(sessionsDir, { recursive: true });

  // Świeższa sesja z prostą treścią…
  const newerId = '11111111-2222-3333-4444-555555555555';
  writeFileSync(
    join(sessionsDir, `${newerId}.jsonl`),
    [
      wpis({ type: 'mode', mode: 'normal' }),
      wpis({ type: 'user', isMeta: true, message: { content: '<local-command-caveat>x' } }),
      wpis({ type: 'user', message: { content: 'Dodaj przycisk zapisu do paska' } }),
    ].join('\n') + '\n',
  );
  // …starsza z treścią w blokach; kolejność w menu: świeższa pierwsza.
  const olderId = '99999999-8888-7777-6666-555555555555';
  const olderPath = join(sessionsDir, `${olderId}.jsonl`);
  writeFileSync(
    olderPath,
    wpis({
      type: 'user',
      message: { content: [{ type: 'text', text: 'Napraw walidację formularza' }] },
    }) + '\n',
  );
  const past = new Date(Date.now() - 60 * 60 * 1000);
  utimesSync(olderPath, past, past);
  // Sesja bez treści (po /clear) ma zniknąć z listy.
  writeFileSync(
    join(sessionsDir, 'aaaaaaaa-0000-0000-0000-000000000000.jsonl'),
    wpis({ type: 'mode', mode: 'normal' }) + '\n',
  );

  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: claudeConfig,
    VISUALN3O_PATH_PREPEND: makeArgEchoClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('bottom-resume').click();
  const menu = page.getByTestId('bottom-resume-menu');
  await expect(menu).toBeVisible();
  const items = page.getByTestId('resume-session');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Dodaj przycisk zapisu do paska');
  await expect(items.nth(1)).toContainText('Napraw walidację formularza');
  await page.screenshot({ path: 'e2e-artifacts/m34-wznawianie-menu.png' });

  // Wybór sesji → karta „Claude ↺" i proces z argumentami --resume <id>.
  await items.nth(0).click();
  await expect(menu).not.toBeVisible();
  const terminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(terminal).toBeVisible();
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab.active')).toContainText(
    'Claude ↺',
  );
  await expect(terminal).toContainText(`ARGS: --resume ${newerId}`, { timeout: 15_000 });
  await page.screenshot({ path: 'e2e-artifacts/m34-wznawianie.png' });

  await app.close();
});
