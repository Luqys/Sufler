import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSlug } from '../../src/shared/claude/claude-sessions';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

const wpis = (obj: object): string => JSON.stringify(obj);

const LIMITY_ID = '11111111-1111-1111-1111-111111111111';
const IKONA_ID = '22222222-2222-2222-2222-222222222222';

/** Dwie rozmowy o różnych rzeczach — fraza ma trafić tylko w jedną. */
function makeTranscripts(project: string): string {
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const dir = join(claudeConfig, 'projects', projectSlug(project));
  mkdirSync(dir, { recursive: true });
  const now = Date.now();

  const zapisz = (id: string, minutesAgo: number, lines: string[]): void => {
    const file = join(dir, `${id}.jsonl`);
    writeFileSync(file, lines.join('\n') + '\n');
    const when = new Date(now - minutesAgo * 60_000);
    utimesSync(file, when, when);
  };

  zapisz(LIMITY_ID, 10, [
    wpis({
      type: 'user',
      timestamp: new Date(now - 40 * 60_000).toISOString(),
      gitBranch: 'm41-limity',
      message: { content: 'Zajmij się czymś zupełnie innym na początek' },
    }),
    wpis({
      type: 'user',
      timestamp: new Date(now - 30 * 60_000).toISOString(),
      message: { content: 'Napraw limity planu przy błędzie 429 na gałęzi wydania' },
    }),
    wpis({
      type: 'assistant',
      timestamp: new Date(now - 29 * 60_000).toISOString(),
      message: { content: [{ type: 'text', text: 'Dodaję cooldown i nagłówek Retry-After.' }] },
    }),
  ]);

  zapisz(IKONA_ID, 120, [
    wpis({
      type: 'user',
      timestamp: new Date(now - 130 * 60_000).toISOString(),
      gitBranch: 'm21-logo',
      message: { content: 'Zaprojektuj ikonkę aplikacji' },
    }),
  ]);
  return claudeConfig;
}

test('M83: fraza z wnętrza rozmowy znajduje sesję, której tytuł jej nie zawiera', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: makeTranscripts(project),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  await expect(page.getByTestId('sessions-panel')).toBeVisible();
  await expect(page.getByTestId('session-item')).toHaveCount(2);

  // Tytuł tej rozmowy to „Zajmij się czymś zupełnie innym…" — filtr po tytułach
  // jej nie znajdzie, bo fraza padła dopiero w środku.
  const filter = page.getByTestId('sessions-filter');
  await filter.fill('cooldown');
  await expect(page.getByTestId('session-item')).toHaveCount(0);

  const hits = page.getByTestId('transcript-hits');
  await expect(hits).toBeVisible({ timeout: 15_000 });
  const hitSessions = page.getByTestId('hit-session');
  await expect(hitSessions).toHaveCount(1);
  await expect(hitSessions.first()).toContainText('Retry-After');
  await expect(hitSessions.first()).toContainText('Claude');

  await page.screenshot({ path: 'e2e-artifacts/m83-szukanie-rozmow.png' });

  // Klik rozwija tę rozmowę na liście, mimo że filtr tytułów jej nie pokazywał.
  await hitSessions.first().click();
  await filter.fill('');
  const opened = page.locator('[data-testid=session-item]', { hasText: 'Zajmij się czymś' });
  await expect(opened.getByTestId('session-message').first()).toBeVisible({ timeout: 15_000 });

  await page.screenshot({ path: 'e2e-artifacts/m83-rozmowa-rozwinieta.png' });
  await app.close();
});

test('M83: krótka fraza nie szuka, a brak trafień mówi to wprost', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: makeTranscripts(project),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  const filter = page.getByTestId('sessions-filter');

  // Dwa znaki to za mało, żeby przemielać transkrypty.
  await filter.fill('li');
  await expect(page.getByTestId('transcript-hits')).toHaveCount(0);

  // Ogonki i wielkość liter nie mają znaczenia.
  await filter.fill('GAŁĘZI');
  await expect(page.getByTestId('hit-session')).toHaveCount(1, { timeout: 15_000 });

  await filter.fill('czegoś takiego nigdzie nie ma');
  await expect(page.getByTestId('hits-empty')).toBeVisible({ timeout: 15_000 });

  await app.close();
});
