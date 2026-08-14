/**
 * Jednolite tempo przewijania (zgłoszenie użytkowników): kółko myszy i gładzik
 * dają w Chromium ten sam typ zdarzenia, ale zupełnie inne delty — mysz rzadkie
 * skoki po ~100 px (czyli ~6 wierszy naraz), gładzik strumień drobnych pikseli.
 * Bez normalizacji ta sama treść przewija się w innym tempie zależnie od
 * urządzenia, a w terminalu wręcz przeskakuje.
 *
 * Zasada: gładzik zostaje nietknięty (jego tempo TO prędkość palca), a kółko
 * myszy dostaje stały krok w wierszach + łagodne przyspieszenie przy szybkim
 * kręceniu. Czysta logika bez DOM — testowana jednostkowo.
 */

export type WheelDevice = 'mouse' | 'trackpad';

/** Bufor xterma: zwykły (ze scrollbackiem) albo ekran alternatywny programu. */
export type TerminalBuffer = 'normal' | 'alternate';

/**
 * Czy kółko przewija NASZ scrollback, czy należy do programu w terminalu.
 *
 * Program w ekranie alternatywnym (Claude Code, vim, less) dostaje własną,
 * czystą planszę — bufor przewijania tam nie istnieje (`baseY` stoi na zerze),
 * a widok przewija sam program, gdy włączy raportowanie myszy. Nasze przejęcie
 * zdarzenia (`preventDefault` + `stopPropagation` + `scrollLines`) zjadało je
 * wtedy bez śladu: xterm nie wysyłał raportu kółka do pty, a `scrollLines`
 * nie miało czego przewinąć. Objaw: w karcie Claude nie da się cofnąć widoku
 * kółkiem ani szybkim gestem gładzika (grubsza delta idzie ścieżką „myszy").
 */
export function wheelScrollsScrollback(buffer: TerminalBuffer): boolean {
  return buffer === 'normal';
}

/** Wycinek zdarzenia `wheel`, na którym pracuje normalizacja. */
export interface WheelSample {
  deltaY: number;
  /** 0 = piksele, 1 = wiersze, 2 = strony (WheelEvent.DOM_DELTA_*). */
  deltaMode: number;
  /** `event.timeStamp` w ms — do wykrycia szybkiego kręcenia. */
  timeStamp: number;
}

export interface ScrollMetrics {
  /** Wysokość wiersza treści w px (wiersz terminala, wiersz listy, linia kodu). */
  lineHeight: number;
  /** Wysokość widocznego obszaru w px — dla delty stronicowej. */
  viewport: number;
}

/** Jedno „kliknięcie" kółka = tyle wierszy. Tyle samo daje gładzik na krótki ruch. */
export const MOUSE_STEP_LINES = 3;

/** Delta w px, od której zdarzenie uznajemy za kółko myszy, a nie gładzik. */
export const MOUSE_DELTA_THRESHOLD = 24;

/** Typowa delta jednego kliknięcia kółka w Chromium na macOS. */
export const MOUSE_NOTCH_DELTA = 100;

/** Do tylu kliknięć kółka odczytujemy z jednej grubej delty (szybkie kręcenie). */
export const MAX_NOTCHES = 4;

/** Przerwa między krokami kółka, poniżej której zaczynamy przyspieszać (ms). */
export const ACCEL_WINDOW_MS = 130;

/** Górna granica mnożnika przyspieszenia. */
export const MAX_ACCEL = 2.5;

/** Kółko czy gładzik — po grubości delty; wiersze/strony to zawsze kółko. */
export function classifyWheel(sample: WheelSample): WheelDevice {
  if (sample.deltaMode !== 0) {
    return 'mouse';
  }
  return Math.abs(sample.deltaY) >= MOUSE_DELTA_THRESHOLD ? 'mouse' : 'trackpad';
}

/** Ile kliknięć kółka niesie delta — gruba delta to szybkie kręcenie. */
export function notchesOf(deltaY: number): number {
  const notches = Math.round(Math.abs(deltaY) / MOUSE_NOTCH_DELTA);
  return Math.min(MAX_NOTCHES, Math.max(1, notches));
}

/**
 * Mnożnik przyspieszenia dla odstępu między kolejnymi krokami kółka:
 * spokojne kręcenie = 1 (stały krok), szybkie = do MAX_ACCEL.
 */
export function accelFor(gapMs: number): number {
  if (!Number.isFinite(gapMs) || gapMs >= ACCEL_WINDOW_MS) {
    return 1;
  }
  const closeness = Math.max(0, ACCEL_WINDOW_MS - Math.max(0, gapMs)) / ACCEL_WINDOW_MS;
  return 1 + closeness * (MAX_ACCEL - 1);
}

export interface NormalizedWheel {
  device: WheelDevice;
  /** Przewinięcie w px. Dla gładzika = delta zdarzenia (bez ingerencji). */
  pixels: number;
  /** To samo w wierszach treści — dla terminala (`scrollLines`). */
  lines: number;
}

/**
 * Normalizator trzyma czas ostatniego kroku kółka, żeby rozpoznać szybkie
 * kręcenie. Jeden na kontener (albo na okno) — stan jest maleńki.
 */
export function createWheelNormalizer(): {
  normalize(sample: WheelSample, metrics: ScrollMetrics): NormalizedWheel;
} {
  let previousMouseAt: number | null = null;
  return {
    normalize(sample: WheelSample, metrics: ScrollMetrics): NormalizedWheel {
      const lineHeight = metrics.lineHeight > 0 ? metrics.lineHeight : 16;
      const device = classifyWheel(sample);
      if (device === 'trackpad') {
        // Gładzik ma już tempo palca — normalizacja tylko by je zepsuła.
        return { device, pixels: sample.deltaY, lines: sample.deltaY / lineHeight };
      }
      const gap = previousMouseAt === null ? Infinity : sample.timeStamp - previousMouseAt;
      previousMouseAt = sample.timeStamp;
      const direction = sample.deltaY < 0 ? -1 : 1;
      const accel = accelFor(gap);
      if (sample.deltaMode === 2) {
        const pages = Math.max(1, Math.round(Math.abs(sample.deltaY)));
        const pixels = direction * pages * metrics.viewport;
        return { device, pixels, lines: pixels / lineHeight };
      }
      const notches = sample.deltaMode === 1 ? Math.max(1, Math.round(Math.abs(sample.deltaY))) : notchesOf(sample.deltaY);
      const lines = direction * notches * MOUSE_STEP_LINES * accel;
      return { device, pixels: lines * lineHeight, lines };
    },
  };
}
