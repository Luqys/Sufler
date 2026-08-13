import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { expect, type Locator, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';

/** Projekt-fixture: repo git z .gitignore, kilkoma plikami i katalogiem node_modules. */
export function makeFixtureProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-proj-'));
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n*.log\n');
  writeFileSync(join(dir, 'README.md'), '# Projekt testowy\n');
  writeFileSync(join(dir, 'debug.log'), 'ukryty\n');
  mkdirSync(join(dir, 'src'));
  writeFileSync(
    join(dir, 'src', 'app.ts'),
    "export const answer = 42;\nconsole.log('witaj', answer);\n",
  );
  mkdirSync(join(dir, 'node_modules', 'fake-pkg'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'fake-pkg', 'index.js'), 'module.exports = 1;\n');
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  const gitEnv = 'git -c user.email=e2e@vn3o.test -c user.name=e2e';
  execSync(`${gitEnv} add -A`, { cwd: dir, stdio: 'ignore' });
  execSync(`${gitEnv} commit -q -m init`, { cwd: dir, stdio: 'ignore' });
  return dir;
}

/**
 * Wpisuje polecenie do terminala i zatwierdza je Enterem.
 *
 * Samo `click()` + `keyboard.type()` bywa zawodne (M82): xterm trzyma wejście
 * w ukrytym `textarea`, a przemontowanie panelu (podział doku, przenosiny
 * karty) przenosi fokus między instancjami. Gdy syntetyczny klawisz trafi
 * w moment przełączania, znak ląduje w niewłaściwym celu albo poza kolejnością
 * — w przebiegu z 13 sierpnia terminal dostał `techo …` zamiast `echo …`.
 *
 * Druga przyczyna, wykryta po M82 (pad m19 mimo helpera, przeżył retry):
 * scenariusz z DWOMA oknami. Fokus w dokumencie nie znaczy, że to okno jest
 * aktywne w systemie — stąd `bringToFront()` przed klikiem.
 *
 * Dlatego: czekamy na klasę `focus` na TYM terminalu, a przed Enterem
 * sprawdzamy, że pty dostało CAŁE polecenie. Niedostarczony znak wychodzi
 * natychmiast i w miejscu, w którym powstał, zamiast po 15 sekundach jako
 * brak wyniku.
 */
export async function wpiszPolecenie(
  page: Page,
  terminal: Locator,
  polecenie: string,
): Promise<void> {
  // Okno docelowe na wierzch PRZED klikiem (M82b). Klasa `focus` mówi tylko
  // o fokusie w dokumencie; gdy scenariusz pracuje na dwóch oknach naraz
  // (m19: okno główne + odczepione), aktywne w systemie bywa to drugie
  // i klawisze trafiają nie tam. Sam fokus elementu tego nie wyklucza.
  await page.bringToFront();
  await terminal.click();
  await expect(terminal).toHaveClass(/(^|\s)focus(\s|$)/);
  await page.keyboard.type(polecenie);
  await expect(terminal).toContainText(polecenie, { timeout: 15_000 });
  await page.keyboard.press('Enter');
}

export function makeConfigHome(): string {
  return mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
}

export function launchApp(
  configHome: string,
  projectRoot?: string,
  extraEnv?: Record<string, string>,
): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env['XDG_CONFIG_HOME'] = configHome;
  if (projectRoot) {
    env['VISUALN3O_ROOT'] = projectRoot;
  } else {
    delete env['VISUALN3O_ROOT'];
  }
  delete env['ELECTRON_RENDERER_URL'];
  // Bez realnych zapytań o limity planu w testach (nadpisywalne przez extraEnv).
  env['VISUALN3O_LIMITS_JSON'] = 'off';
  Object.assign(env, extraEnv);
  return electron.launch({ args: ['.'], env });
}

/**
 * Atrapa binarki `claude` do hermetycznych testów M4: wypisuje sygnały statusu
 * rozpoznawane przez heurystykę i odpowiada na wpisywane linie.
 */
export function makeFakeClaudeBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-bin-'));
  const script = `#!/bin/zsh
if [[ "$1" == "/login" ]]; then
  echo "TRYB-LOGOWANIA: claude /login (atrapa)"
  echo "Otworz przegladarke i wklej kod…"
  while IFS= read -r line; do :; done
  exit 0
fi
echo "── Claude Code (atrapa) ──"
echo "? for shortcuts"
while IFS= read -r line; do
  if [[ "$line" == perm* ]]; then
    echo "Do you want to allow this tool?"
    echo "  1. Yes"
    echo "  2. No"
  else
    echo "esc to interrupt"
    sleep 0.2
    echo "odpowiedz: $line"
    echo "? for shortcuts"
  fi
done
`;
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

export interface DecodedPng {
  width: number;
  height: number;
  /** Kanały R, G, B piksela (alfa pomijamy — zrzuty są nieprzezroczyste). */
  pixel(x: number, y: number): [number, number, number];
}

/**
 * Minimalny czytnik PNG (8 bitów na kanał, RGB/RGBA, bez interlace) — tyle
 * wystarcza dla zrzutów Playwrighta. Potrzebny, bo o widoczności ikon
 * decydują FAKTYCZNE piksele: deklaracje CSS z `color-mix()` liczą się do
 * `oklab()`, a przezroczystość składa się dopiero z tłem pod spodem.
 */
export function decodePng(bytes: Buffer): DecodedPng {
  if (bytes.subarray(1, 4).toString('latin1') !== 'PNG') {
    throw new Error('to nie PNG');
  }
  let width = 0;
  let height = 0;
  let colorType = 6;
  const data: Buffer[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1');
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8) {
        throw new Error('obsługiwane tylko 8 bitów na kanał');
      }
      colorType = body[9] ?? 6;
      if (body[12] !== 0) {
        throw new Error('obsługiwany tylko PNG bez interlace');
      }
    } else if (type === 'IDAT') {
      data.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  // Odwrócenie filtrów PNG — każdy wiersz zaczyna się bajtem typu filtra.
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)] ?? 0;
    const source = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const target = pixels.subarray(row * stride, (row + 1) * stride);
    const previous = row === 0 ? null : pixels.subarray((row - 1) * stride, row * stride);
    for (let index = 0; index < stride; index += 1) {
      const rawByte = source[index] ?? 0;
      const left = index >= channels ? (target[index - channels] ?? 0) : 0;
      const up = previous ? (previous[index] ?? 0) : 0;
      const upLeft = previous && index >= channels ? (previous[index - channels] ?? 0) : 0;
      let value = rawByte;
      if (filter === 1) {
        value = rawByte + left;
      } else if (filter === 2) {
        value = rawByte + up;
      } else if (filter === 3) {
        value = rawByte + ((left + up) >> 1);
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const distances = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        const nearest = Math.min(...distances);
        value = rawByte + (nearest === distances[0] ? left : nearest === distances[1] ? up : upLeft);
      }
      target[index] = value & 0xff;
    }
  }
  return {
    width,
    height,
    pixel(x: number, y: number): [number, number, number] {
      const base = y * stride + x * channels;
      return [pixels[base] ?? 0, pixels[base + 1] ?? 0, pixels[base + 2] ?? 0];
    },
  };
}

/** Luminancja względna wg WCAG. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Kontrast najciemniejszego do najjaśniejszego piksela zrzutu — dla wycinka
 * z jedną ikoną na jednolitym tle to wprost kontrast ikony do tła.
 */
export function extremeContrast(png: DecodedPng): number {
  let darkest = 1;
  let lightest = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const value = luminance(png.pixel(x, y));
      darkest = Math.min(darkest, value);
      lightest = Math.max(lightest, value);
    }
  }
  return Number(((lightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/** Konfiguracja z zapisanym motywem — renderer barwi się od startu (M58). */
export function makeConfigHomeWithMode(mode: 'dark' | 'light' | 'matrix'): string {
  const dir = makeConfigHome();
  mkdirSync(join(dir, 'sufler'), { recursive: true });
  writeFileSync(
    join(dir, 'sufler', 'state.json'),
    JSON.stringify({ appearance: { mode, accent: 'clay', language: 'pl' } }, null, 2),
  );
  return dir;
}

/**
 * Atrapa `claude`, która pokazuje SUROWE bajty wejścia (`cat -v`): ESC jako
 * `^[`, CR jako `^M`. Tylko tak da się w teście odróżnić Shift+Enter (nowa
 * linia, ESC+CR) od zwykłego Entera (CR) — prawdziwe CLI czyta klawisze, nie
 * linie, więc atrapa czytająca linie zatarłaby różnicę.
 */
export function makeRawKeysClaudeBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-bin-'));
  // PRÓBOWANE I ODRZUCONE (M91): dopisanie `tee` przed `cat -v`, żeby zapisać
  // surowe bajty do pliku i rozdzielić „nie doszło" od „nie narysowało się".
  // Wstawienie potoku przenosi wejście `cat` z terminala na potok, a wtedy
  // wypisuje on blokowo zamiast na bieżąco — scenariusz zaczął padać
  // powtarzalnie. Pomiar nie może zaburzać tego, co mierzy.
  const script = `#!/bin/zsh
echo "── Claude Code (atrapa klawiszy) ──"
echo "? for shortcuts"
# Tryb surowy jak w prawdziwym TUI: bajt po bajcie, bez echa i bez zamiany
# CR na LF (w trybie kanonicznym to ona domyka linię, więc zatarłaby różnicę
# między Enterem (CR) i Shift+Enterem (ESC+CR)).
stty raw -echo 2>/dev/null
exec cat -v
`;
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}
