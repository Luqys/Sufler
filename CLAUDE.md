# Sufler

Środowisko pracy z Claude Code (Electron + React + TypeScript). Pełna specyfikacja
i kamienie milowe: **docs/SPEC.md** — przeczytaj przed rozpoczęciem pracy.

## Komendy

- `npm run dev` — aplikacja w trybie dev (HMR)
- `npm run typecheck`, `npm run lint`
- `npm run dist` — `.dmg` dla arm64 i x64 (bez podpisu; node-pty z prebuildów, `npmRebuild: false`)

Definicja ukończenia kamienia milowego: `npm run typecheck`, `npm run lint`
i `npm run build` zielone, a zmiana sprawdzona w uruchomionej aplikacji.

## Struktura

- `src/main` — proces główny Electrona (okno, IPC, zapis układu do `~/.config/sufler/layout.json`; testy nadpisują lokalizację przez `XDG_CONFIG_HOME`, a korzeń projektu przez `VISUALN3O_ROOT`)
- `src/preload` — most contextBridge (`window.api`, typ `WindowApi` w `src/shared/ipc.ts`)
- `src/shared` — typy i czysta logika współdzielona między procesami (tu trzymać logikę testowalną jednostkowo)
- `src/renderer` — UI w React; komponenty w `src/renderer/src/components`

## Zasady

- Każdy kamień milowy: osobna sesja, osobna gałąź (`m<numer>-<nazwa>`), `/clear` pomiędzy (szczegóły w docs/SPEC.md).
- Teksty UI wyłącznie przez słownik i18n (`src/shared/i18n.ts`, PL i EN — typ wymusza komplet tłumaczeń; w rendererze hook `useT` + `tf`/`tp` z `src/renderer/src/i18n.ts`). Polski jest domyślny, angielski przełącza się w Ustawieniach.
- Oba doki to ten sam komponent `Dock`; zakładki `terminal` i `claude` różnią się wyłącznie komendą startową pty.
