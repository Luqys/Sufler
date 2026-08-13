import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSlug } from '../src/shared/claude-sessions';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

const wpis = (obj: object): string => JSON.stringify(obj);

/** Transkrypty z zużyciem w katalogu, który widzi CLI (<config>/projects/<slug>). */
function makeTranscripts(project: string): string {
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const dir = join(claudeConfig, 'projects', projectSlug(project));
  mkdirSync(dir, { recursive: true });
  const today = new Date();
  const iso = (hoursAgo: number): string =>
    new Date(today.getTime() - hoursAgo * 3_600_000).toISOString();

  writeFileSync(
    join(dir, '11111111-2222-3333-4444-555555555555.jsonl'),
    [
      wpis({ type: 'user', timestamp: iso(3), message: { content: 'Dodaj przycisk' } }),
      wpis({
        type: 'assistant',
        timestamp: iso(2),
        message: {
          model: 'claude-opus-5',
          usage: {
            input_tokens: 120,
            output_tokens: 4500,
            cache_creation_input_tokens: 30_000,
            cache_read_input_tokens: 900_000,
          },
        },
      }),
    ].join('\n') + '\n',
  );
  writeFileSync(
    join(dir, '99999999-8888-7777-6666-555555555555.jsonl'),
    [
      wpis({
        type: 'assistant',
        timestamp: iso(30),
        message: {
          model: 'claude-haiku-4-5',
          usage: { input_tokens: 40, output_tokens: 800 },
        },
      }),
    ].join('\n') + '\n',
  );
  return claudeConfig;
}

test('M73: panel Sesje pokazuje zużycie tokenów z transkryptów', async () => {
  const project = makeFixtureProject();
  const claudeConfig = makeTranscripts(project);

  const app = await launchApp(makeConfigHome(), project, { CLAUDE_CONFIG_DIR: claudeConfig });
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  await expect(page.getByTestId('sessions-panel')).toBeVisible();

  const usage = page.getByTestId('usage-history');
  await expect(usage).toBeVisible();

  // 120 + 4500 + 30 000 + 900 000 + 40 + 800 = 935 460 → zapis skrócony.
  await expect(page.getByTestId('usage-total')).toContainText('935');

  // Wykres ma słupek na każdy z czternastu dni, także pusty.
  await expect(page.getByTestId('usage-bar')).toHaveCount(14);

  // Rozbicie na modele — oba modele z transkryptów.
  const models = page.getByTestId('usage-model');
  await expect(models).toHaveCount(2);
  await expect(models.first()).toContainText('claude-opus-5');

  await expect(usage).toContainText('odczyt cache');

  await page.screenshot({ path: 'e2e-artifacts/m73-zuzycie.png' });
  await app.close();
});

test('M73: projekt bez transkryptów nie pokazuje pustego wykresu', async () => {
  const project = makeFixtureProject();
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-pusty-'));

  const app = await launchApp(makeConfigHome(), project, { CLAUDE_CONFIG_DIR: claudeConfig });
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  await expect(page.getByTestId('sessions-panel')).toBeVisible();
  await expect(page.getByTestId('usage-history')).toHaveCount(0);

  await app.close();
});
