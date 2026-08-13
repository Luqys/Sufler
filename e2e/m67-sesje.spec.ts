import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSlug } from '../src/shared/claude-sessions';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

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

const NOWSZA_ID = '11111111-2222-3333-4444-555555555555';
const STARSZA_ID = '99999999-8888-7777-6666-555555555555';

/** Katalog transkryptów, jaki widzi CLI: <config>/projects/<slug korzenia>. */
function makeSessions(project: string): string {
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const dir = join(claudeConfig, 'projects', projectSlug(project));
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, `${NOWSZA_ID}.jsonl`),
    [
      wpis({ type: 'mode', mode: 'normal' }),
      wpis({ type: 'user', isMeta: true, message: { content: '<local-command-caveat>x' } }),
      wpis({
        type: 'user',
        timestamp: '2026-08-12T10:00:00.000Z',
        gitBranch: 'm67-sesje',
        message: { content: 'Dodaj przycisk zapisu do paska' },
      }),
      wpis({
        type: 'assistant',
        timestamp: '2026-08-12T10:00:20.000Z',
        message: {
          content: [
            { type: 'text', text: 'Dorzucam przycisk i test' },
            { type: 'tool_use', name: 'Edit', input: {} },
          ],
        },
      }),
      wpis({
        type: 'user',
        timestamp: '2026-08-12T10:04:00.000Z',
        message: { content: 'Zmień jeszcze etykietę na Zapisz' },
      }),
    ].join('\n') + '\n',
  );

  const starsza = join(dir, `${STARSZA_ID}.jsonl`);
  writeFileSync(
    starsza,
    wpis({
      type: 'user',
      message: { content: [{ type: 'text', text: 'Napraw walidację formularza' }] },
    }) + '\n',
  );
  const past = new Date(Date.now() - 60 * 60 * 1000);
  utimesSync(starsza, past, past);

  // Sesja bez treści (po /clear) nie ma czego pokazać — znika z listy.
  writeFileSync(
    join(dir, 'aaaaaaaa-0000-0000-0000-000000000000.jsonl'),
    wpis({ type: 'mode', mode: 'normal' }) + '\n',
  );
  return claudeConfig;
}

test('panel Sesje listuje rozmowy projektu, pokazuje podgląd i wznawia sesję', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: makeSessions(project),
    VISUALN3O_PATH_PREPEND: makeArgEchoClaudeBin(),
  });
  const page = await app.firstWindow();

  // Zakładka w lewym pasku: lista od najświeższej, bez sesji pustych po /clear.
  await page.getByTestId('rail-sessions').click();
  const panel = page.getByTestId('sessions-panel');
  await expect(panel).toBeVisible();
  const items = page.getByTestId('session-item');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Dodaj przycisk zapisu do paska');
  await expect(items.nth(0)).toContainText('m67-sesje');
  await expect(items.nth(1)).toContainText('Napraw walidację formularza');

  // Rozwinięcie czyta transkrypt: liczniki i ostatnie wymiany.
  await items.nth(0).getByTestId('session-row').click();
  await expect(panel).toContainText('2 polecenia');
  await expect(panel).toContainText('1 odpowiedź');
  await expect(panel).toContainText('1 narzędzie');
  const messages = page.getByTestId('session-message');
  await expect(messages).toHaveCount(3);
  await expect(messages.nth(1)).toContainText('Dorzucam przycisk i test');
  await expect(messages.nth(2)).toContainText('Zmień jeszcze etykietę na Zapisz');
  await page.screenshot({ path: 'e2e-artifacts/m67-panel-sesji.png' });

  // Wznowienie: karta „Claude ↺" w dolnym doku z `claude --resume <id>`.
  await items.nth(0).getByTestId('session-resume').click();
  const terminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(terminal).toBeVisible();
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab.active')).toContainText(
    'Claude ↺',
  );
  await expect(terminal).toContainText(`ARGS: --resume ${NOWSZA_ID}`, { timeout: 15_000 });
  await page.screenshot({ path: 'e2e-artifacts/m67-wznowienie-z-panelu.png' });

  await app.close();
});

test('panel Sesje mówi wprost, gdy projekt nie ma jeszcze żadnej rozmowy', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    CLAUDE_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'vn3o-claude-pusty-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  await expect(page.getByTestId('sessions-panel')).toContainText('Brak zapisanych sesji');
  await expect(page.getByTestId('session-item')).toHaveCount(0);

  await app.close();
});
