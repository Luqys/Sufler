import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

const PORT = 39421;

function sseData(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');
}

async function mcpCall(body: unknown): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return text.includes('data:') ? sseData(text) : text;
}

test('Claude tworzy skill przez MCP, a panel widzi go bez restartu', async () => {
  const project = makeFixtureProject();
  // Katalog skilli musi istnieć przy starcie — chokidar nie łapie ścieżek
  // powstających po uruchomieniu obserwacji.
  const starter = join(project, '.claude', 'skills', 'startowy');
  mkdirSync(starter, { recursive: true });
  writeFileSync(join(starter, 'SKILL.md'), '---\nname: startowy\ndescription: Od początku\n---\n');
  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_MCP_PORT: String(PORT),
  });
  const page = await app.firstWindow();
  await page.getByTestId('rail-knowledge').click();
  await expect(page.getByTestId('knowledge-mcp')).toContainText('działa', { timeout: 15_000 });

  const created = await mcpCall({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'skill_nowy',
      arguments: { nazwa: 'skill-z-mcp', opis: 'Utworzony przez sesję Claude', tresc: '## Kroki\n\n1. Test\n' },
    },
  });
  expect(created).toContain('Utworzono skill');
  const path = join(project, '.claude', 'skills', 'skill-z-mcp', 'SKILL.md');
  expect(existsSync(path)).toBe(true);
  expect(readFileSync(path, 'utf8')).toContain('Utworzony przez sesję Claude');

  const listed = await mcpCall({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'skille_lista', arguments: {} },
  });
  expect(listed).toContain('skill-z-mcp');
  expect(listed).toContain('wlaczony');

  // Panel skilli podchwytuje nowy wpis przez chokidar — bez restartu.
  await page.getByTestId('rail-skills').click();
  await expect(page.getByTestId('skills-panel').getByText('skill-z-mcp')).toBeVisible({
    timeout: 10_000,
  });
  await page.screenshot({ path: 'e2e-artifacts/m48-skille-mcp.png' });
  await app.close();
});
