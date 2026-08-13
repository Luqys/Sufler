# Sufler

Środowisko pracy z Claude Code (Electron + React + TypeScript). Pełna specyfikacja
i kamienie milowe: **docs/SPEC.md** — przeczytaj przed rozpoczęciem pracy.

## Komendy

- `npm run dev` — aplikacja w trybie dev (HMR)
- `npm test` — testy jednostkowe (vitest, katalog `tests/`)
- `npm run e2e` — build + testy Playwright (otwiera na chwilę okna aplikacji; zrzuty w `e2e-artifacts/`)
- `npm run typecheck`, `npm run lint`
- `npm run dist` — `.dmg` dla arm64 i x64 (bez podpisu; node-pty z prebuildów, `npmRebuild: false`)

Definicja ukończenia kamienia milowego: wszystkie cztery komendy zielone
+ zrzut ekranu ze scenariusza e2e.

## Struktura

Katalogi dzielą się **tematycznie**, tą samą siatką w każdej warstwie (M81):
nowy plik idzie do katalogu swojego obszaru, nie na płaską stertę.

- `src/main` — proces główny Electrona. `index.ts` to wyłącznie okno i rejestracja
  IPC; reszta w podkatalogach: `claude/` (sesje, dziennik, punkty, limity, hooki,
  serwer „ide", pty), `project/` (korzeń projektu, drzewo, obserwatory, szukanie),
  `git/`, `knowledge/` (notatki, graf, MCP wiedzy, Obsidian), `skills/`, `mcp/`,
  `window/` (menu, układ, stan, okna odczepione), `system/` (powłoka, schowek, i18n).
  Układ zapisywany do `~/.config/sufler/layout.json`; testy nadpisują lokalizację
  przez `XDG_CONFIG_HOME`, a korzeń projektu przez `VISUALN3O_ROOT`.
- `src/preload` — most contextBridge (`window.api`, typ `WindowApi` w `src/shared/ipc.ts`)
- `src/shared` — typy i czysta logika współdzielona między procesami (tu trzymać
  logikę testowalną jednostkowo). Podkatalogi: `claude/`, `docks/`, `editor/`,
  `git/`, `knowledge/`, `mcp/`, `skills/`, `project/`, `system/`; `ipc.ts`
  i `i18n/` zostają na wierzchu jako kontrakty całej aplikacji.
- `src/renderer` — UI w React. Komponenty w `components/` z podziałem na
  `dock/`, `editor/`, `sidebar/`, `graph/`, `dialogs/`, `views/`, `shell/`.
  Style: `styles.css` to spis treści, moduły w `styles/` ładowane **w kolejności**
  (kaskada zależy od kolejności — szlify świadomie idą na końcu).
- `tests` — vitest, podział lustrzany do `src/shared`; `e2e` — Playwright
  (`_electron`) pogrupowane obszarami: `start/`, `dock/`, `editor/`, `panele/`,
  `wiedza/`, `ustawienia/`. Nazwa pliku zachowuje numer kamienia (`m42-…`).

## Zasady

- Każdy kamień milowy: osobna sesja, osobna gałąź (`m<numer>-<nazwa>`), `/clear` pomiędzy (szczegóły w docs/SPEC.md).
- Teksty UI wyłącznie przez słownik i18n (`src/shared/i18n.ts`, PL i EN — typ wymusza komplet tłumaczeń; w rendererze hook `useT` + `tf`/`tp` z `src/renderer/src/i18n.ts`). Polski jest domyślny, angielski przełącza się w Ustawieniach.
- Oba doki to ten sam komponent `Dock`; zakładki `terminal` i `claude` różnią się wyłącznie komendą startową pty.
