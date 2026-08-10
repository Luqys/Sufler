import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('język UI: przełączenie na angielski działa w całej aplikacji i zapisuje się', async () => {
  const configHome = makeConfigHome();
  const app = await launchApp(configHome, makeFixtureProject());
  const page = await app.firstWindow();

  // Domyślnie polski.
  await expect(page.getByTestId('bottom-dock')).toContainText(
    'Kliknij +, aby otworzyć terminal lub sesję Claude.',
  );

  // Ustawienia → English.
  await page.keyboard.press('Meta+,');
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('language-en').click();
  await expect(page.getByTestId('settings-dialog')).toContainText('Settings');
  await expect(page.getByTestId('settings-dialog')).toContainText('Appearance');
  await page.keyboard.press('Escape');

  // Teksty w rendererze przełączone bez restartu.
  await expect(page.getByTestId('bottom-dock')).toContainText(
    'Click + to open a terminal or a Claude session.',
  );
  await expect(page.getByTestId('open-chat')).toHaveAttribute('title', /Chat with Claude/);

  // Wybór wylądował w state.json (przeżyje restart).
  await expect
    .poll(() => {
      try {
        const raw = JSON.parse(
          readFileSync(join(configHome, 'sufler', 'state.json'), 'utf8'),
        ) as { appearance?: { language?: string } };
        return raw.appearance?.language ?? null;
      } catch {
        return null;
      }
    })
    .toBe('en');

  await page.screenshot({ path: 'e2e-artifacts/m26-jezyk-en.png' });

  // Powrót na polski.
  await page.keyboard.press('Meta+,');
  await page.getByTestId('language-pl').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bottom-dock')).toContainText('Kliknij +, aby otworzyć');

  await app.close();
});
