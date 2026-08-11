import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

const LOG = `---
kategoria: Dziennik sesji
tagi: [dziennik, claude]
---

# Dziennik sesji — projekt

## 10:00 — polecenie

Napraw limity planu

- \`10:01\` edycja: \`src/limits.ts\`
- \`10:02\` powłoka: \`npm test\`
- \`10:03\` edycja: \`src/ui.tsx\`
- \`10:04\` zapis: \`docs/limity.md\`
`;

test('streszczenie dziennika: Claude podsumowuje, sekcja ląduje na górze pliku', async () => {
  const project = makeFixtureProject();
  mkdirSync(join(project, 'dziennik-sesji'), { recursive: true });
  const logPath = join(project, 'dziennik-sesji', '2026-08-11-abcdef12.md');
  writeFileSync(logPath, LOG);

  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_SUMMARY_TEXT: '**Zrobione:**\n- naprawiony limit planu\n\n**Następny krok:**\n- sprawdzić prognozę',
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  const button = page.getByTestId('knowledge-summarize');
  await expect(button).toBeVisible({ timeout: 15_000 });
  await button.click();

  await expect.poll(() => readFileSync(logPath, 'utf8'), { timeout: 20_000 }).toContain(
    '## Podsumowanie',
  );
  const content = readFileSync(logPath, 'utf8');
  expect(content).toContain('naprawiony limit planu');
  expect(content).toContain('Następny krok');
  // Przebieg pracy zostaje pod podsumowaniem.
  expect(content).toContain('edycja: `src/ui.tsx`');
  expect(content.indexOf('## Podsumowanie')).toBeLessThan(content.indexOf('## 10:00'));
  // Frontmatter nietknięty na samej górze.
  expect(content.startsWith('---\nkategoria: Dziennik sesji')).toBe(true);

  await page.screenshot({ path: 'e2e-artifacts/m54-streszczenie.png' });
  await app.close();
});
