# VisualN3O

Środowisko pracy z Claude Code (Electron + React + TypeScript). Pełna specyfikacja
i kamienie milowe: **SPEC.md** — przeczytaj przed rozpoczęciem pracy.

## Komendy

- `npm run dev` — aplikacja w trybie dev (HMR)
- `npm test` — testy jednostkowe (vitest, katalog `tests/`)
- `npm run e2e` — build + testy Playwright (otwiera na chwilę okna aplikacji; zrzuty w `e2e-artifacts/`)
- `npm run typecheck`, `npm run lint`

Definicja ukończenia kamienia milowego: wszystkie cztery komendy zielone
+ zrzut ekranu ze scenariusza e2e.

## Struktura

- `src/main` — proces główny Electrona (okno, IPC, zapis układu do `~/.config/visualn3o/layout.json`; testy nadpisują lokalizację przez `XDG_CONFIG_HOME`, a korzeń projektu przez `VISUALN3O_ROOT`)
- `src/preload` — most contextBridge (`window.api`, typ `WindowApi` w `src/shared/ipc.ts`)
- `src/shared` — typy i czysta logika współdzielona między procesami (tu trzymać logikę testowalną jednostkowo)
- `src/renderer` — UI w React; komponenty w `src/renderer/src/components`
- `e2e` — testy Playwright (`_electron`), `tests` — vitest

## Zasady

- Każdy kamień milowy: osobna sesja, osobna gałąź (`m<numer>-<nazwa>`), `/clear` pomiędzy (szczegóły w SPEC.md).
- Teksty UI po polsku.
- Oba doki to ten sam komponent `Dock`; zakładki `terminal` i `claude` różnią się wyłącznie komendą startową pty.
