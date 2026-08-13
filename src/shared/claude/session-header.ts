import { stripAnsi } from './claude-status';

/**
 * Odczyt AKTUALNEGO modelu i głębokości myślenia z wyjścia sesji (M92).
 *
 * Panel sterowania z M84 umiał tylko przełączać — po kliknięciu nie było
 * wiadomo, co właściwie jest ustawione, a po `--resume` albo po zmianie
 * z klawiatury panel i sesja rozjeżdżały się w milczeniu. CLI wypisuje jedno
 * i drugie w nagłówku sesji, np.:
 *
 *   Opus 5 (1M context) with xhigh · Claude Max · ~/projekt
 *
 * i potwierdza zmianę osobnym wierszem („Set model to sonnet"). Czytamy oba,
 * bo pierwszy pojawia się przy starcie, a drugi w trakcie pracy.
 *
 * Czysta logika na tekście — testowana jednostkowo, bez terminala.
 */

export type ModelSesji = 'opus' | 'sonnet' | 'haiku';
export type WysilekSesji = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface StanSesji {
  model: ModelSesji | null;
  /** Pełna nazwa z nagłówka („Opus 5 (1M context)") — panel pokazuje ją dosłownie. */
  modelOpis: string | null;
  wysilek: WysilekSesji | null;
}

export const PUSTY_STAN: StanSesji = { model: null, modelOpis: null, wysilek: null };

const RODZINY: Array<[ModelSesji, RegExp]> = [
  ['opus', /\bopus\b/i],
  ['sonnet', /\bsonnet\b/i],
  ['haiku', /\bhaiku\b/i],
];

const WYSILKI: WysilekSesji[] = ['xhigh', 'max', 'high', 'medium', 'low'];

function rodzinaZ(tekst: string): ModelSesji | null {
  for (const [model, wzorzec] of RODZINY) {
    if (wzorzec.test(tekst)) {
      return model;
    }
  }
  return null;
}

/**
 * Stan z ogona wyjścia. Zwraca to, co znalazł NAJPÓŹNIEJ — przy `/model`
 * w trakcie sesji liczy się ostatnie potwierdzenie, nie nagłówek startowy.
 * Pola bez trafienia zostają `null`, żeby panel nie zgadywał.
 */
export function stanZWyjscia(ogon: string): StanSesji {
  const tekst = stripAnsi(ogon);
  let stan: StanSesji = { ...PUSTY_STAN };

  // 1. Nagłówek sesji: „Opus 5 (1M context) with xhigh · …"
  const naglowki = [...tekst.matchAll(/^\s*((?:Opus|Sonnet|Haiku)[^\n·]*?)(?:\s+with\s+(\w+))?\s*(?:·|$)/gim)];
  const ostatniNaglowek = naglowki[naglowki.length - 1];
  if (ostatniNaglowek) {
    const opis = (ostatniNaglowek[1] ?? '').trim();
    stan = {
      model: rodzinaZ(opis),
      modelOpis: opis === '' ? null : opis,
      wysilek: (WYSILKI.find((poziom) => poziom === ostatniNaglowek[2]?.toLowerCase()) ?? null),
    };
  }

  // 2. Potwierdzenia zmian w trakcie — mają pierwszeństwo nad nagłówkiem.
  const zmianyModelu = [...tekst.matchAll(/Set model to\s+([A-Za-z0-9.\- ]+)/gi)];
  const ostatniModel = zmianyModelu[zmianyModelu.length - 1];
  if (ostatniModel) {
    const opis = (ostatniModel[1] ?? '').trim();
    const model = rodzinaZ(opis);
    if (model) {
      stan = { ...stan, model, modelOpis: opis };
    }
  }

  const zmianyWysilku = [...tekst.matchAll(/(?:Set effort to|Effort set to)\s+(\w+)/gi)];
  const ostatniWysilek = zmianyWysilku[zmianyWysilku.length - 1];
  const poziom = WYSILKI.find((wartosc) => wartosc === ostatniWysilek?.[1]?.toLowerCase());
  if (poziom) {
    stan = { ...stan, wysilek: poziom };
  }

  return stan;
}

/**
 * Śledzenie stanu na strumieniu pty. Ogon trzymamy krótki — nagłówek i
 * potwierdzenia mieszczą się w kilku kilobajtach, a cały scrollback byłby
 * kosztowny przy każdym chunku.
 */
export function createSessionStateTracker(onChange: (stan: StanSesji) => void): {
  push(chunk: string): void;
} {
  let ogon = '';
  let poprzedni: StanSesji = { ...PUSTY_STAN };
  return {
    push(chunk: string): void {
      ogon = (ogon + chunk).slice(-8000);
      const stan = stanZWyjscia(ogon);
      if (
        stan.model !== poprzedni.model ||
        stan.wysilek !== poprzedni.wysilek ||
        stan.modelOpis !== poprzedni.modelOpis
      ) {
        poprzedni = stan;
        onChange(stan);
      }
    },
  };
}
