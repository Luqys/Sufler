import type { TabSignal } from '../../shared/docks/tab-signals';

/**
 * Dźwięki stanu kart Claude (M100). Syntezowane w Web Audio zamiast plików:
 * trzy krótkie motywy to kilkanaście linijek, a paczka aplikacji zostaje bez
 * zasobów binarnych — nic do podpisania, nic do wersjonowania, nic do
 * przeoczenia w buildzie.
 */

interface Ton {
  hz: number;
  /** Sekundy od początku motywu. */
  od: number;
  dlugosc: number;
  ksztalt: OscillatorType;
}

/**
 * Trzy motywy różnią się kierunkiem, nie tylko wysokością — po dźwięku ma być
 * jasne, co się stało, bez patrzenia w okno. Rosnąca kwarta = skończone,
 * dwa równe klepnięcia = pytanie, opadająca sekunda w dole = błąd.
 */
const MOTYWY: Record<TabSignal, Ton[]> = {
  done: [
    { hz: 660, od: 0, dlugosc: 0.12, ksztalt: 'sine' },
    { hz: 880, od: 0.1, dlugosc: 0.18, ksztalt: 'sine' },
  ],
  attention: [
    { hz: 830, od: 0, dlugosc: 0.09, ksztalt: 'triangle' },
    { hz: 830, od: 0.16, dlugosc: 0.09, ksztalt: 'triangle' },
  ],
  error: [
    { hz: 300, od: 0, dlugosc: 0.16, ksztalt: 'sawtooth' },
    { hz: 200, od: 0.14, dlugosc: 0.26, ksztalt: 'sawtooth' },
  ],
};

/** Szczyt obwiedni — na tyle cicho, żeby nie płoszyć przy nocnej pracy. */
const GLOSNOSC = 0.07;

let kontekst: AudioContext | null = null;

function audio(): AudioContext | null {
  if (kontekst) {
    return kontekst;
  }
  const Ctor = window.AudioContext;
  if (!Ctor) {
    return null;
  }
  kontekst = new Ctor();
  return kontekst;
}

/**
 * Zagranie motywu. Cicho nic nie robi, gdy przeglądarka nie da kontekstu —
 * dźwięk jest dodatkiem do koloru karty, nie jedynym nośnikiem informacji.
 */
export function playTabSignal(signal: TabSignal): void {
  const ctx = audio();
  if (!ctx) {
    return;
  }
  // Kontekst budzi się dopiero po interakcji; w aplikacji zawsze jakaś była.
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const start = ctx.currentTime + 0.01;
  for (const ton of MOTYWY[signal]) {
    const oscylator = ctx.createOscillator();
    const wzmocnienie = ctx.createGain();
    oscylator.type = ton.ksztalt;
    oscylator.frequency.value = ton.hz;
    // Obwiednia zamiast prostokąta: gołe włączenie oscylatora trzaska.
    const od = start + ton.od;
    wzmocnienie.gain.setValueAtTime(0.0001, od);
    wzmocnienie.gain.exponentialRampToValueAtTime(GLOSNOSC, od + 0.015);
    wzmocnienie.gain.exponentialRampToValueAtTime(0.0001, od + ton.dlugosc);
    oscylator.connect(wzmocnienie).connect(ctx.destination);
    oscylator.start(od);
    oscylator.stop(od + ton.dlugosc + 0.02);
  }
}
