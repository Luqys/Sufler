import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSlug } from '../../src/shared/claude/claude-sessions';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

const wpis = (obj: object): string => JSON.stringify(obj);

interface Sesja {
  id: string;
  /** Ile godzin temu skończyła się rozmowa. */
  hoursAgo: number;
  /** Doba, w której ma wylądować na liście: 0 = dziś, 1 = wczoraj, 4 = dawniej. */
  dayOffset: number;
  minutes: number;
  prompt: string;
  branch: string;
}

const SESJE: Sesja[] = [
  { id: '11111111-1111-1111-1111-111111111111', hoursAgo: 0.05, dayOffset: 0, minutes: 12, prompt: 'zrób push do maina', branch: 'main' },
  { id: '22222222-2222-2222-2222-222222222222', hoursAgo: 6, dayOffset: 0, minutes: 40, prompt: "'/var/folders/g4/tmp/Zrzut ekranu.png' zaprojektuj ikonkę", branch: 'm21-logo' },
  { id: '33333333-3333-3333-3333-333333333333', hoursAgo: 30, dayOffset: 1, minutes: 25, prompt: 'napraw limity planu przy 429', branch: 'm41-limity' },
  { id: '44444444-4444-4444-4444-444444444444', hoursAgo: 96, dayOffset: 4, minutes: 90, prompt: 'graf wiedzy z kategoriami', branch: 'm23-graf' },
];

/**
 * Koniec rozmowy przycięty do doby, w której ma być widoczna. Samo odjęcie
 * godzin wiąże wynik z porą uruchomienia testu: po północy „6 h temu" spada
 * na wczoraj i zamiast trzech grup wychodzą cztery (spec padał między 00:00
 * a 06:00). W ciągu dnia przycinanie nic nie zmienia.
 */
function endOfSession(now: number, sesja: Sesja): number {
  const target = new Date(now - sesja.dayOffset * 86_400_000);
  const dayStart = new Date(target).setHours(0, 30, 0, 0);
  const dayEnd = sesja.dayOffset === 0 ? now : new Date(target).setHours(23, 30, 0, 0);
  return Math.min(Math.max(now - sesja.hoursAgo * 3_600_000, dayStart), dayEnd);
}

/** Transkrypty w katalogu, który widzi CLI: <config>/projects/<slug>. */
function makeTranscripts(project: string): string {
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const dir = join(claudeConfig, 'projects', projectSlug(project));
  mkdirSync(dir, { recursive: true });
  const now = Date.now();
  for (const sesja of SESJE) {
    const endMs = endOfSession(now, sesja);
    const startMs = endMs - sesja.minutes * 60_000;
    const file = join(dir, `${sesja.id}.jsonl`);
    writeFileSync(
      file,
      [
        wpis({
          type: 'user',
          timestamp: new Date(startMs).toISOString(),
          gitBranch: sesja.branch,
          message: { content: sesja.prompt },
        }),
        wpis({
          type: 'assistant',
          timestamp: new Date(endMs).toISOString(),
          message: { model: 'claude-opus-5', content: [{ type: 'text', text: 'Zrobione.' }] },
        }),
      ].join('\n') + '\n',
    );
    // mtime = ostatnia aktywność: po nim panel grupuje i sortuje.
    utimesSync(file, new Date(endMs), new Date(endMs));
  }
  return claudeConfig;
}

test('M80: sesje pogrupowane po dniach, z godziną, gałęzią i czasem trwania', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: makeTranscripts(project),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  await expect(page.getByTestId('sessions-panel')).toBeVisible();
  await expect(page.getByTestId('session-item')).toHaveCount(4);

  // Grupy dni: dzisiejsze dwie rozmowy razem, starsze osobno.
  const groups = page.getByTestId('session-group');
  await expect(groups).toHaveCount(3);
  await expect(groups.first()).toContainText('Dziś');
  await expect(groups.first().getByTestId('session-item')).toHaveCount(2);
  await expect(groups.nth(1)).toContainText('Wczoraj');

  // Najświeższa rozmowa ma kropkę „sprzed chwili" i czytelny temat.
  const first = groups.first().getByTestId('session-item').first();
  await expect(first).toContainText('zrób push do maina');
  await expect(first.getByTestId('session-live')).toBeVisible();
  await expect(first).toContainText('main');
  // Czas trwania jest w podpowiedzi godziny — w tej szerokości trzeci fakt
  // zjadałby nazwę gałęzi.
  await expect(first.locator('.session-clock')).toHaveAttribute('title', /12 min/);

  // Wklejona ścieżka nie jest tematem — zostaje treść polecenia.
  const withPath = page.locator('[data-testid=session-item]', { hasText: 'zaprojektuj ikonkę' });
  await expect(withPath).toBeVisible();
  await expect(withPath).not.toContainText('/var/folders');

  await page.screenshot({ path: 'e2e-artifacts/m80-sesje-lista.png' });
  await app.close();
});

test('M80: szukajka zawęża listę, także po gałęzi i po ukrytej ścieżce', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: makeTranscripts(project),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  const filter = page.getByTestId('sessions-filter');
  await expect(filter).toBeVisible();

  await filter.fill('limity');
  await expect(page.getByTestId('session-item')).toHaveCount(1);
  await expect(page.getByTestId('session-item')).toContainText('napraw limity planu');

  // Gałąź też jest wyszukiwalna.
  await filter.fill('m23-graf');
  await expect(page.getByTestId('session-item')).toContainText('graf wiedzy');

  // Surowy tytuł ze ścieżką nadal da się znaleźć, choć na liście go nie widać.
  await filter.fill('zrzut ekranu');
  await expect(page.getByTestId('session-item')).toHaveCount(1);
  await expect(page.getByTestId('session-item')).toContainText('zaprojektuj ikonkę');

  // Fraza bez trafień mówi to wprost zamiast pokazywać pustkę.
  await filter.fill('czegoś takiego nie ma');
  await expect(page.getByTestId('session-item')).toHaveCount(0);
  await expect(page.getByTestId('sessions-no-match')).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m80-sesje-szukajka.png' });
  await app.close();
});
