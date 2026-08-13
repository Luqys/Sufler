# SPEC.md — własne środowisko pracy z Claude Code

## Cel

Aplikacja desktopowa (macOS) łącząca w jednym oknie: przeglądarkę plików projektu,
edytor kodu, oraz doki z zakładkami, w których działa albo sesja Claude Code, albo
zwykły shell. Dodatkowo dwa panele inspekcyjne: drzewo dostępnych skilli/agentów
i drzewo skonfigurowanych serwerów MCP wraz z ich statusem połączenia.

**To nie jest klon VS Code.** Brak: rozszerzeń, debuggera, autouzupełniania inline,
obsługi plików >50 MB. Jeśli któraś z tych rzeczy okaże się potrzebna, jest to
sygnał do porzucenia projektu na rzecz gotowego edytora, nie do rozszerzania zakresu.

## Stack

- **Electron** jako powłoka. Uzasadnienie: pseudoterminale są centralnym elementem
  tej aplikacji, a `node-pty` + `xterm.js` to natywny stos Node'owy. Tauri dałoby
  mniejszy binarny rozmiar, ale wymusiłoby most przez `portable-pty` w Rust dla
  najważniejszej funkcji aplikacji. Jeśli po M4 okaże się, że waga aplikacji boli,
  migracja jest możliwa — trzyma się cała logika w rendererze.
- **TypeScript** wszędzie.
- **Monaco Editor** — silnik edytora wyciągnięty z VS Code (MIT).
- **xterm.js** + **node-pty** — terminale.
- **chokidar** — obserwowanie zmian w drzewie plików.
- **Vite** do buildu renderera.
- **Playwright** do testów e2e (patrz: Weryfikacja).

## Układ okna

```
┌──────────┬────────────────────────────┬──────────────────┐
│ SIDEBAR  │  EDYTOR (Monaco, zakładki) │  PRAWY DOK       │
│          │                            │                  │
│ [Pliki]  │                            │  [Claude] [+]    │
│ [Skille] ├────────────────────────────┤                  │
│ [MCP]    │  DOLNY DOK                 │                  │
│          │  [zsh] [Claude] [+]        │                  │
└──────────┴────────────────────────────┴──────────────────┘
```

- Sidebar: pasek ikon przełączający trzy widoki (Pliki / Skille / MCP).
- Doki: prawy i dolny. Oba są instancjami **tego samego komponentu `Dock`**.
- Rozmiary paneli zapisywane w `~/.config/<app>/layout.json`, przywracane przy starcie.
- Skróty: `Cmd+B` sidebar, `` Ctrl+` `` dolny dok, `Cmd+Shift+C` prawy dok.

## Model danych: Dock, Pane, Tab

To jest centralna abstrakcja aplikacji. Zaimplementować ją poprawnie przed M4.

```ts
type TabKind = 'terminal' | 'claude';

interface Tab {
  id: string;
  kind: TabKind;
  title: string;        // dla 'terminal': nazwa shella; dla 'claude': tytuł sesji
  cwd: string;
  ptyId: number;        // uchwyt do procesu w main
  status: 'idle' | 'running' | 'needs-input' | 'exited';
}
```

**Kluczowa zasada: `terminal` i `claude` różnią się WYŁĄCZNIE komendą startową
pseudoterminala.** Zakładka `terminal` uruchamia `process.env.SHELL`, zakładka
`claude` uruchamia `claude`. Wszystko inne — renderowanie przez xterm.js, obsługa
resize, zapis scrollbacku, zamykanie — jest wspólne. Nie duplikować kodu.

Przycisk `[+]` w nagłówku doku otwiera menu z dwiema pozycjami: „Sesja Claude"
i „Terminal". Wybór tworzy nową zakładkę w tym doku.

Zakładki muszą dać się przeciągać między dokami (prawym i dolnym). Przeciągnięcie
nie restartuje procesu — zmienia tylko, który dok renderuje dany `ptyId`.

### Wskaźnik statusu

Zakładka `claude` pokazuje kropkę statusu, gdy nie jest aktywna:
- pomarańczowa — Claude skończył pracę,
- niebieska — Claude czeka na zgodę (permission prompt).

Detekcja w v1: heurystyka na strumieniu wyjściowym pty (wykrywanie znanych wzorców
promptu). Jeśli okaże się zawodna, przejść na hook `Notification` w
`~/.claude/settings.json`, który pisze do lokalnego gniazda aplikacji — to jest
deterministyczne i tak właśnie należy to zrobić docelowo.

## Panel: Pliki

- Drzewo katalogów od korzenia otwartego projektu.
- Respektowanie `.gitignore` (przełączalne — `node_modules` domyślnie ukryte).
- Kliknięcie pliku otwiera go w edytorze; podwójne kliknięcie „przypina" zakładkę.
- Menu kontekstowe: Otwórz w terminalu (tworzy zakładkę `terminal` z `cwd` na tym
  katalogu), Kopiuj ścieżkę, Pokaż w Finderze, **Wstaw jako `@ścieżka` do aktywnej
  sesji Claude**.
- Kolorowanie nazw wg statusu git (zmodyfikowany / nieśledzony), odczyt przez
  `git status --porcelain`, odświeżanie na zdarzeniach chokidar z debounce 300 ms.

## Panel: Skille i agenci

Widok drzewa z czterema grupami. Dane czytane z dysku, parsowane z frontmattera YAML.

| Grupa | Źródło | Pola z frontmattera |
|---|---|---|
| Skille projektu | `<root>/.claude/skills/*/SKILL.md` | `name`, `description`, `disable-model-invocation`, `disallowed-tools` |
| Skille osobiste | `~/.claude/skills/*/SKILL.md` | jw. |
| Subagenci | `<root>/.claude/agents/*.md` | `name`, `description`, `tools`, `model` |
| Reguły | `<root>/.claude/rules/*.md` | `paths` (jeśli obecne — pokazać jako badge) |

Zachowanie:
- Kliknięcie pozycji otwiera odpowiadający plik `.md` w edytorze.
- `Cmd+klik` wstawia `/nazwa-skilla` do inputu aktywnej sesji Claude.
- Pod nazwą wyświetlany `description` jednym wierszem, wyszarzony, z ellipsis.
- Badge `manual` przy skillach z `disable-model-invocation: true`.
- Obserwowanie obu katalogów przez chokidar — dodanie skilla ma się pojawić bez restartu.
- Osobna sekcja na dole: lista plików `CLAUDE.md` widocznych dla projektu
  (korzeń projektu, `~/.claude/CLAUDE.md`, `CLAUDE.local.md`) z licznikiem linii
  przy każdym. To jest diagnostyka rozdmuchania kontekstu — długi CLAUDE.md
  powoduje, że Claude gubi instrukcje.

## Panel: MCP

Dwa źródła danych, oba potrzebne. Konfiguracja mówi, co jest **zdefiniowane**;
CLI mówi, co jest **połączone**.

**Konfiguracja (odczyt plików, natychmiastowy):**

| Scope | Plik | Uwagi |
|---|---|---|
| `local` | `~/.claude.json` | kluczowany ścieżką projektu |
| `user` | `~/.claude.json` | globalny, poziom najwyższy |
| `project` | `<root>/.mcp.json` | commitowany do repo, współdzielony z zespołem |

**Status (wywołanie CLI, asynchroniczne):**
- `claude mcp list` — lista z aktualnym stanem połączenia. Serwery ze scope
  `project` potrafią być w stanie oczekiwania na zatwierdzenie, dopóki ktoś
  z zespołu ich nie zaakceptuje.
- `claude mcp get <nazwa>` — szczegóły pojedynczego serwera.

Przed implementacją sprawdzić `claude mcp list --help` — zestaw flag i format
wyjścia zmienia się między wersjami, więc parser trzymać w jednym module
(`src/main/mcp/parse.ts`) z testami na przykładowym wyjściu, żeby zmiana formatu
psuła jeden plik, a nie całą aplikację.

Wyświetlanie: nazwa serwera, transport (`stdio` / `http` / `sse`), scope jako badge,
kropka statusu (zielona połączony / czerwona błąd / szara oczekujący). Rozwinięcie
węzła pokazuje szczegóły z `claude mcp get`. Odświeżanie: przy starcie, przy zmianie
plików konfiguracyjnych i przyciskiem odświeżania (bez pollingu — wywołania CLI są
wolne).

## Edytor

- Monaco, zakładki, `Cmd+S` zapisuje na dysk.
- Wykrywanie zewnętrznej zmiany pliku (chokidar) → pasek ostrzegawczy z opcjami
  „Przeładuj" / „Zachowaj moją wersję". To jest krytyczne, bo Claude edytuje pliki
  pod spodem — bez tego stracisz zmiany.
- Podświetlanie składni z wbudowanych gramatyk Monaco. **Bez LSP w tej wersji.**

## Weryfikacja

Każdy kamień milowy musi mieć sprawdzenie, które Claude może uruchomić sam.
Bez tego stajesz się pętlą weryfikacyjną i tracisz cały zysk z automatyzacji.

- `npm test` — testy jednostkowe (parsery frontmattera, parser `mcp list`,
  logika układu doków).
- `npm run e2e` — Playwright przeciw zbudowanej aplikacji Electron. Każdy
  kamień milowy dokłada scenariusz, np. M4: „otwórz nową zakładkę Claude
  w prawym doku, sprawdź że proces wystartował, zamknij ją, sprawdź że proces
  został ubity".
- `npm run typecheck` i `npm run lint`.

Definicja ukończenia kamienia milowego: wszystkie cztery przechodzą, a Claude
załącza zrzut ekranu aplikacji w stanie po wykonaniu scenariusza e2e.

## Kamienie milowe

| # | Zakres | Sprawdzenie |
|---|---|---|
| M0 | Szkielet Electron + Vite + TS, puste okno z czterema obszarami układu, zapis rozmiarów | e2e: okno się otwiera, panele mają zapisane rozmiary po restarcie |
| M1 | Panel plików: drzewo, `.gitignore`, otwieranie w edytorze | e2e: kliknięcie pliku otwiera go w Monaco |
| M2 | Edytor: zakładki, zapis, detekcja zmian zewnętrznych | e2e: edycja + zapis + modyfikacja pliku z zewnątrz pokazuje pasek |
| M3 | Dock/Pane/Tab z zakładką `terminal`, przycisk `+`, przeciąganie między dokami | e2e: `echo test` w terminalu zwraca `test` |
| M4 | Zakładka `claude` (ta sama ścieżka kodu, inna komenda), wskaźniki statusu | e2e: sesja startuje, zamknięcie ubija proces |
| M5 | Panel skilli i agentów | test jedn.: parser frontmattera; e2e: dodanie SKILL.md pojawia się bez restartu |
| M6 | Panel MCP | test jedn.: parser `mcp list` na fixture'ach; e2e: panel renderuje serwery z `.mcp.json` |
| M7 | Status git w drzewie, wyszukiwanie w projekcie (ripgrep), skróty klawiszowe | e2e: wyszukiwanie znajduje znany ciąg |
| M8 | Integracja z Obsidianem, warstwy 1–2 (patrz niżej) | e2e: vault jako drugi korzeń, edycja i zapis notatki |
| M9 | Pakowanie i wydanie na macOS | `npm run dist` produkuje działający `.dmg`, aplikacja startuje z `/Applications` |

Każdy kamień w osobnej sesji Claude Code, na osobnym branchu (`claude --worktree`).
Między kamieniami `/clear`.

## Kamienie milowe po v1 (M68+)

Tabela wyżej zamyka v1. Kamienie M10–M63 nie trafiły do niej wcale — dopisywały się
do sekcji tematycznych albo do niczego. Skutek: **numeracja żyje w `git log`, nie tutaj**.
Zanim weźmiesz numer, sprawdź:

```
git log --all --oneline | grep -oE '^[0-9a-f]+ M[0-9]+' | grep -oE 'M[0-9]+' | sort -u -t M -k2 -n
```

Stan na 2026-08-13: zajęte ciągiem M0–M63, gałęzie `m65-dystrybucja`
i `m66-poprawki-zgloszenia`, M67 (panel „Sesje"), M68 (slash-komendy),
M69 (commit z aplikacji), M70 (edytor hooków), M73 (historia zużycia),
M74 (paleta komend), M75 (pasek ikon), M76 (ekran startowy tworzy folder)
M77 (szlif UI i podział przeciągnięciem) oraz M78 (uruchamianie `claude`
na Windowsie) — cztery ostatnie ze zgłoszeń z pracy z aplikacją. Wolne:
M64 (luka w środku, zostawić), M71–M72 (propozycje z tabeli poniżej)
i M79 w górę.

**Numer w tabeli poniżej jest propozycją, nie rezerwacją.** Sesja startująca kamień
bierze pierwszy wolny numer z komendy wyżej i poprawia tu wiersz. Inaczej backlog
blokuje siedem numerów na pracę, która może nigdy nie ruszyć, a kolejna sesja i tak
weźmie numer z gita. Tak powstało M67: wiersze przesunęły się o jeden, bo numer
wziął panel „Sesje".

Poniższa lista jest różnicą wobec **tipa łańcucha**, nie wobec `main` — `main` stoi na
M29 i nie zawiera trzydziestu kilku kamieni. Wszystko, co oczywiste, jest już zrobione:
deterministyczny status z hooków (M35, M44), punkty przywracania (M55), oś czasu pracy
(M56), dziennik sesji (M52–M54), wznawianie sesji (M34), warstwa 3 Obsidiana (M36),
`Cmd+P` (M37), serwer `ide` (`src/main/ide-server.ts`), widok diffa (`DiffView.tsx`).

Zasady bez zmian: osobna sesja, osobna gałąź `m<numer>-<nazwa>`, `/clear` pomiędzy,
cztery komendy zielone plus zrzut ekranu ze scenariusza e2e.

| # | Zakres | Sprawdzenie |
|---|---|---|
| ~~M68~~ | ~~Slash-komendy z `.claude/commands` jako czwarta grupa panelu skilli~~ (zrobione) | test jedn.: `tests/commands.test.ts`; e2e: `e2e/m68-komendy.spec.ts` |
| ~~M69~~ | ~~Commit z aplikacji — wybór plików i wiadomość obok istniejącego `DiffView`~~ (zrobione) | test jedn.: `tests/git-commit.test.ts`; e2e: `e2e/m69-commit.spec.ts` |
| ~~M70~~ | ~~Edytor hooków w Ustawieniach — te same warstwy co `skillOverrides`~~ (zrobione) | test jedn.: `tests/hooks-config.test.ts`; e2e: `e2e/m70-hooki.spec.ts` |
| M71 | Diagnostyka bez LSP — `tsc` i `eslint` w pasku, klik skacze do linii | test jedn.: parser wyjścia obu narzędzi → `{plik, linia, kolumna, treść}`; e2e: błąd składni pokazuje się w pasku i otwiera plik na właściwej linii |
| M72 | Worktree'y — kilka sesji Claude na jednym zadaniu, porównanie i scalenie | test jedn.: mapowanie karta → worktree w `layout.json`; e2e: utworzenie worktree'a daje kartę z własnym `cwd`, usunięcie sprząta katalog |
| ~~M73~~ | ~~Historia zużycia z transkryptów `.jsonl`~~ (zrobione) | test jedn.: `tests/usage-history.test.ts`; e2e: `e2e/m73-zuzycie.spec.ts` |
| ~~M74~~ | ~~Paleta komend `Cmd+K` — panele, akcje doków, motywy~~ (zrobione) | test jedn.: `tests/command-palette.test.ts`; e2e: `e2e/m74-paleta.spec.ts` |

Kolejność sensowna, nie obowiązkowa: M68 i M69 są tanie i domykają rzeczy zaczęte
(panel skilli, `DiffView`). M71 i M72 to jedyne dwa duże kamienie na tej liście.

### M66 — poprawki ze zgłoszeń użytkowników (zrobione)

Pięć rzeczy z listy zgłoszonej przez użytkowników. Wszystkie były błędami, nie
życzeniami — dlatego jeden kamień, nie pięć.

1. **Shift+Enter w karcie Claude** wysyłał zwykły CR, więc próba złamania
   polecenia na dwie linie wysyłała je do Claude. xterm dostał własną obsługę
   klawisza: ESC+CR (`src/shared/terminal-keys.ts`) — dokładnie to wiązanie
   zakłada `claude /terminal-setup` w iTermie i VS Code. Zwykły terminal
   zostaje bez zmian, bo powłoka nie zna ESC+CR.
2. **Kopiowanie polecenia przyciskiem** w pasku karty Claude: zaznaczenie
   z terminala, a gdy go nie ma — ostatnie wysłane polecenie. Treść bierze się
   z hooka `UserPromptSubmit`, który i tak przychodził z `ptyId` karty
   (M35/M52); brakowało tylko przekazania jej do renderera.
3. **Jednolite tempo przewijania** (`src/shared/scroll.ts`): kółko myszy ma
   stały krok w wierszach plus łagodne przyspieszenie przy szybkim kręceniu,
   gładzik zostaje natywny, bo jego tempo to prędkość palca. Osobne wejścia dla
   trzech mechanizmów przewijania: DOM (`src/renderer/src/wheel.ts`, łapie też
   paski zakładek — tam pionowe kółko przewija w poziomie), bufor xterm
   i Monaco.
4. **Druga przeglądarka** nie powstawała, bo wszystkie podglądy miały jedną
   pseudo-ścieżkę `vn3o://preview`, a pasek zakładek deduplikuje po ścieżce —
   drugie kliknięcie tylko aktywowało istniejącą kartę. Kolejne podglądy dostają
   `vn3o://preview/<n>` i własny, pamiętany adres.
5. **Sekcja MCP w panelu Wiedza** czytała status raz, przy montowaniu, a
   `listen()` jest asynchroniczny — panel potrafił zostać na „uruchamianie" do
   końca życia okna. Teraz main rozgłasza zmianę stanu, a zajęty port (szybki
   restart aplikacji) jest ponawiany kilka razy zamiast gasnąć na stałe.

### M67 — panel „Sesje" w lewym pasku (zrobione)

Wznawianie sesji (M34) siedziało wyłącznie w menu przy ✳ w doku — dobre do
„wróć do ostatniej rozmowy", za ciasne do przeglądania historii. Panel `Sesje`
w lewym pasku pokazuje zapisane rozmowy projektu jak `Historia git` pokazuje
commity: tytuł z pierwszego polecenia, czas ostatniej aktywności, gałąź z czasu
rozmowy, a po rozwinięciu liczniki (polecenia, odpowiedzi, użycia narzędzi)
i podgląd ostatnich wymian. Przycisk ↺ w wierszu startuje `claude --resume <id>`
w dolnym doku.

Warstwa danych to ta sama, co w M34 (`src/shared/claude-sessions.ts`,
`src/main/claude-sessions.ts`) — rozszerzona o skaner transkryptu karmiony
linia po linii. Transkrypty sięgają dziesiątek megabajtów, więc lista czyta
tylko początek pliku (tytuł, gałąź, początek rozmowy), a pełne rozliczenie
robi się strumieniowo dopiero po rozwinięciu wiersza.

### M78 — uruchamianie `claude` na Windowsie (zrobione)

Zgłoszenie z paczki Windows: „Nie udało się uruchomić `claude`: File not found".
Trzy założenia z macOS zaszyte w starcie pseudoterminala:

1. **`claude` z npm to na Windowsie `claude.cmd`**, a `CreateProcess` (pod
   ConPTY) nie uruchamia plików wsadowych. Rozwiązana ścieżka z rozszerzeniem
   `.cmd`/`.bat` idzie teraz przez `cmd.exe /d /s /c`, `.ps1` przez
   `powershell.exe -File`, a `.exe` wprost.
2. **Rozwiązanie nazwy wymaga PATHEXT**, nie samego PATH — kandydatów składa
   `executableCandidates` (`src/shared/exec-path.ts`), z `.exe` przed `.cmd`.
   Nazwa jest sprawdzana PRZED spawnem, więc brak `claude` kończy się zdaniem
   „Nie znaleziono polecenia `claude` w PATH… `npm i -g @anthropic-ai/claude-code`"
   zamiast komunikatu z wnętrza node-pty.
3. **Domyślna powłoka `/bin/zsh` nie istnieje** — na Windowsie bierze się
   `COMSPEC`. Sonda logowanej powłoki (`$SHELL -ilc env`) jest tam pomijana:
   `cmd.exe` nie ma plików rc, a próba kosztowała sekundy zwłoki. `PATH`
   sklejany jest separatorem systemu, nie dwukropkiem.

Przy okazji **hooki**: komenda budowana dla `sh` (`$ZMIENNA`, `>/dev/null`,
`|| true`) na Windowsie nie zadziałałaby po cichu — status kart spadłby na
heurystykę strumienia, a dziennik sesji przestałby powstawać. `buildHookSettings`
dostało wariant `win32` (`%VISUALN3O_TAB_ID%`, `curl.exe`, `>NUL`, `exit /b 0`).

**Czego NIE zweryfikowano:** samego Windowsa — cała maszyneria zmian jest pokryta
testami jednostkowymi dla obu platform (`tests/exec-path.test.ts`,
`tests/claude-hooks.test.ts`), a e2e sprawdza wspólną ścieżkę błędu przy pustym
PATH. Potwierdzenie na Windowsie wymaga uruchomienia paczki na tym systemie.

### M77 — szlif interfejsu i podział doku przeciągnięciem (zrobione)

Pięć zgłoszeń z pracy z aplikacją, w jednym kamieniu.

1. **Znak na ekranie startowym to ikona aplikacji** (`src/renderer/src/assets/logo.png`,
   skalowana z `build/icon.png`), a nie osobny rysunek dymka — start przestał
   wyglądać jak inny program niż ten w Docku.
2. **Panel Sesje bez wykresu dobowego.** Słupki z M73 zajmowały górę panelu
   i nie mówiły nic o pracy; zostaje suma i rozbicie na modele liczbami,
   domyślnie zwinięte.
3. **Czytelne etykiety sesji** (`sessionLabel` w `src/shared/claude-sessions.ts`):
   pierwsze polecenie często zaczyna się od wklejonej ścieżki, więc lista była
   rzędem `'/var/folders/g4/czjdmg…`. Ścieżki z początku wypadają, zostaje treść
   polecenia; gdy polecenie było samą ścieżką — jej ostatni element. Do tego
   hairline między wpisami, oddech w wierszu i widoczny od razu przycisk wznawiania.
4. **Nakładka grafu w jednej metryce**: licznik jako plakietka 26 px, tyle samo
   pole szukania i przyciski (wcześniej licznik był gołym tekstem na innej linii
   bazowej). Pięć trybów w trzykolumnowym rastrze — przy `flex: 1` zawijały się
   na 3 + 2 i drugi rząd miał przyciski półtora raza szersze.
5. **Podział doku przeciągnięciem karty do krawędzi panelu** — to, co dotąd
   dawał tylko przycisk. Oś zależy od doku (SPEC wyżej): dolny dzieli się na
   kolumny, więc liczy się pozycja w poziomie, prawy na wiersze — w pionie.
   Strefa krawędzi to 25% szerokości/wysokości; panel węższy niż 120 px nie
   dzieli się wcale. Podczas przeciągania połowa panelu podświetla się kolorem
   przewodnim, więc widać wynik przed puszczeniem przycisku.

Czysta logika stref w `src/shared/dock-drop.ts`, przenoszenie karty do nowego
panelu w `moveTabToNewPane` (`src/shared/dock-tabs.ts`) — w odróżnieniu od
`splitPane` działa też dla karty z innego panelu i z drugiego doku.

### M76 — ekran startowy tworzy folder roboczy (zrobione)

Zgłoszenie z pracy z aplikacją: ekran startowy miał jeden przycisk „Otwórz
folder…", więc nowy projekt trzeba było założyć w Finderze i wrócić do Suflera.
Teraz start ma dwie równorzędne drogi — **Nowy projekt** (karta domyślna,
w kolorze przewodnim) i **Otwórz folder…** — obie z jednowierszowym
wyjaśnieniem, co robią.

Formularz nowego projektu rozwija się w miejscu, bez skoku do osobnego okna:
nazwa, lokalizacja (podpowiadana jako katalog obok ostatnio otwartego projektu,
zmienialna wpisem albo dialogiem) i przełącznik `git init`. Trzy decyzje
projektowe warte zapamiętania:

- **Podgląd pełnej ścieżki** pod polami — bez niego „Utwórz" jest skokiem
  w ciemno, bo nazwa folderu nie mówi, gdzie on powstanie.
- **`git init` domyślnie włączony, z pierwszym commitem i README.** Punkty
  przywracania (M55) i panel Git bez repozytorium nie mają czego pokazać,
  a pusty katalog nie ma commita, do którego mogłyby się przyczepić. Brak gita
  w systemie nie unieważnia folderu — projekt zostaje, wynik mówi `git: false`.
- **`mkdir` bez `recursive`**, żeby istniejący katalog dał jawny błąd `exists`
  zamiast zostać po cichu przyjęty jako „nowy" projekt.

Walidacja nazwy siedzi w `src/shared/project-create.ts` (te same reguły
w rendererze i w main): puste, ukośnik lub dwukropek, kropka na początku, znaki
psujące ścieżki, znaki kontrolne, długość. Białe znaki na brzegach są obcinane,
nie odrzucane.

### M75 — lewy pasek ikon (zrobione)

Zgłoszenie z pracy z aplikacją: ikony przełączające panele są za małe i zbyt
mało widoczne. Były to kwadraty 32 px z ikoną 17 px w kolorze `--muted`, więc
na ciemnym motywie ledwo odcinały się od tła paska. Po zmianie: pasek 52 px,
cel 40 px, ikona 22 px, kolor `--text` zmieszany do 66% (zamiast `--muted`),
tło pod kursorem i jednoznaczny stan aktywny — tło w kolorze przewodnim plus
pigułka przy krawędzi paska, żeby otwarty panel dało się rozpoznać kątem oka.

Widoczność jest sprawdzana na FAKTYCZNYCH pikselach zrzutu (`decodePng`
+ `extremeContrast` w `e2e/utils.ts`), a nie na deklaracjach CSS — `color-mix()`
liczy się do `oklab()` z alfą, więc realny kontrast powstaje dopiero po
złożeniu z tłem. Próg w teście: 3:1, tyle WCAG wymaga od elementów graficznych
interfejsu. Motyw w teście bierze się z zapisanego `state.json`
(`makeConfigHomeWithMode`), nie z `emulateMedia` — przy tym drugim watcher
trybu „systemowego" (M58) przełącza paletę asynchronicznie i pomiar łapie stan
w trakcie zmiany.

### M68 — slash-komendy w panelu (zrobione)

Panel znał skille, subagentów i reguły; komendy z `.claude/commands/*.md`
(oraz `~/.claude/commands/*.md`) były czwartym rodzajem tego samego pliku
z frontmatterem i jedynym, którego brakowało. Ten sam parser
(`src/shared/frontmatter.ts`), ten sam watcher, to samo `Cmd+klik` wstawiające
`/nazwa` do aktywnej sesji.

- Nazwa wynika ze ścieżki: podkatalogi tworzą przestrzenie nazw rozdzielane
  dwukropkiem (`commands/frontend/build.md` → `/frontend:build`), jak w CLI.
  Zejście rekurencyjne ma płytki limit, żeby dowiązanie w kółko nie zapętliło panelu.
- Frontmatter: `description` pod nazwą, `argument-hint` jako plakietka obok niej,
  `model` i `allowed-tools` w danych wpisu. Komenda bez `description` zostaje
  na liście — sama nazwa, bez wiersza opisu.
- Komenda projektu przykrywa osobistą o tej samej nazwie, tak jak w CLI; komendy
  osobiste mają plakietkę zakresu.
- Logika nazw w `src/shared/commands.ts`, odczyt w `readCommands`
  (`src/main/skills.ts`).

### M69 — commit z aplikacji (zrobione)

`DiffView` pokazywał zmianę, ale zatwierdzić ją trzeba było w terminalu. Panel Git
ma teraz przy każdej zmianie roboczej pole wyboru, pod listą opis i przycisk
zatwierdzenia z licznikiem zaznaczonych plików.

- Commit jest **częściowy** (`git add -- <ścieżki>` + `git commit -- <ścieżki>`), więc
  bierze wyłącznie zaznaczone pliki. Co ktoś zastage'ował osobno, zostaje w indeksie —
  aplikacja nie zmienia stanu repozytorium pod palcami pracującego człowieka.
- Bez stage'owania po kawałkach (`git apply --cached` na hunkach) — to osobna
  mechanika i osobny kamień, jeśli w ogóle. Zaznaczenie jest per plik.
- Bez `push` — świadomie. Wypychanie zostaje w terminalu.
- Autor commita bierzemy z konfiguracji gita repozytorium, aplikacja nie ustawia
  własnego. Brak `user.name`/`user.email` ma własny komunikat, bo to najczęstsza
  przyczyna odmowy w świeżym repozytorium.
- Zaznaczenie jest uzgadniane z aktualną listą zmian (`plannedPaths`), więc plik
  zatwierdzony w terminalu albo cofnięty nie wjedzie do commita z rozpędu.
- Logika w `src/shared/git-commit.ts`, wykonanie w `src/main/git-commit.ts`.

### M70 — edytor hooków (zrobione)

Hooki były wstrzykiwane przez Suflera dla własnych potrzeb; użytkownik swoich nie
miał jak dodać inaczej niż ręczną edycją JSON-a. Ustawienia mają teraz sekcję
„Hooki Claude Code": lista wpisów ze wszystkich trzech warstw plus formularz
(zdarzenie, opcjonalny wzorzec narzędzia, komenda).

- Warstwy identyczne jak przy `skillOverrides`: `.claude/settings.local.json` >
  `.claude/settings.json` > `~/.claude/settings.json`. Ta sama zasada zapisu do
  najmocniejszej warstwy, która już ma wpis.
- Zdarzenia (sprawdzone w binarce CLI 2.1.229, tak jak kontrakt `skillOverrides`):
  `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStop`,
  `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `PreCompact`.
- Payload na stdin hooka, przydatny w podpowiedziach UI: `hook_event_name`,
  `session_id`, `transcript_path`, `cwd`, `tool_name`, `tool_input`, `tool_response`,
  `permission_mode`, `stop_hook_active`.
- **Hooki statusu kart nie pojawiają się na tej liście** — idą osobną drogą przez
  `claude --settings '<JSON>'` (flaga przyjmuje ciąg JSON, nie tylko ścieżkę) i nie są
  częścią konfiguracji użytkownika. Wymieszanie obu źródeł skończyłoby się tym, że ktoś
  skasuje z UI hooka, od którego zależy status kart.
- Wyjątkiem jest **globalny dziennik sesji** (M53), który naprawdę siedzi
  w `~/.claude/settings.json`. Takie wpisy lista pokazuje z plakietką „Sufler"
  i bez przycisku usuwania: właścicielem jest przełącznik dziennika wyżej,
  a skasowanie ich tutaj rozjechałoby oba miejsca.
- Grupy o tym samym wzorcu są łączone zamiast mnożone; usunięcie ostatniej komendy
  sprząta pustą grupę, puste zdarzenie i pustą mapę `hooks`.
- Logika w `src/shared/hooks-config.ts`, zapis w `src/main/hooks-config.ts`.

### M71 — diagnostyka bez LSP

Edytor bez podkreślonych błędów jest notatnikiem. Pełne LSP zostaje poza zakresem
(patrz niżej); tańszy substytut daje większość zysku:

- `tsc --watch --pretty false` i `eslint --format json` jako procesy w tle,
  uruchamiane **na żądanie**, nie zawsze — na dużym repo to realny koszt CPU.
- Parser w `src/shared/diagnostics.ts`, testy na zamrożonych fixture'ach wyjścia obu
  narzędzi. Format `tsc` zmienia się między wersjami — ten sam reżim co parser `mcp list`.
- Wynik jako `monaco.editor.setModelMarkers` plus licznik w pasku pod edytorem.
- **To jest granica zakresu.** Jeśli w trakcie pojawi się pokusa autouzupełniania
  albo „idź do definicji", to sygnał z sekcji „Cel", a nie materiał na kolejny kamień.

### M72 — worktree'y

Praca kilkoma sesjami naraz odbywa się dziś ręcznie, poza aplikacją.

- Sufler sam robi `git worktree add` i otwiera kartę z `cwd` na nowym katalogu.
  Nie używać `claude --worktree`: wtedy katalog wybiera CLI, a drzewo plików
  i panel Git nie wiedzą o nowym korzeniu.
- Widok porównawczy: diff worktree ↔ gałąź bazowa przez istniejący `DiffView`.
- „Scal ten" = `git merge --no-ff` do gałęzi bazowej. Konflikt kończy się komunikatem
  i pozostawieniem stanu do ręcznego rozwiązania — żadnej automatyki na konfliktach.
- Usunięcie karty pyta, czy sprzątnąć worktree (`git worktree remove`); domyślnie nie,
  bo tam mogą być niescommitowane zmiany.

### M73 — historia zużycia (zrobione)

`UsageIndicator` pokazywał stan chwilowy, M57 prognozę wyczerpania limitu —
brakowało przeszłości. Panel „Sesje" ma teraz na górze zwijaną sekcję „Zużycie
tokenów": suma projektu, wykres ostatnich czternastu dni i rozbicie na modele.

- Liczone z `message.usage` wpisów `assistant` w transkryptach
  (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens` — schemat sprawdzony na prawdziwym pliku).
- Skaner jest **strumieniowy** i karmiony linia po linii, bo transkrypty sięgają
  trzydziestu megabajtów; liczymy na żądanie panelu, bez pollingu.
- Podział na dni idzie po **dacie lokalnej**, nie UTC — inaczej wieczorna praca
  lądowałaby w następnym dniu. Testy liczą oczekiwane daty tą samą funkcją,
  więc przechodzą w każdej strefie (sprawdzone w UTC i Pacific/Auckland).
- Zakres dni jest ciągły: dni bez pracy dostają zera i rysują się kreską tła,
  żeby przerwy było widać zamiast ściskać słupki obok siebie.
- Projekt bez ani jednej odpowiedzi modelu nie pokazuje sekcji w ogóle.
- Katalog transkryptów bierze się z `CLAUDE_CONFIG_DIR`, więc e2e podstawia własny
  zamiast czytać katalog użytkownika.

### M74 — paleta komend (zrobione)

`Cmd+P` otwiera pliki (M37). `Cmd+K` otwiera resztę: siedem paneli bocznych, nowa
sesja Claude i nowy terminal, przełączniki trzech obszarów układu, motyw
jasny/ciemny/systemowy, Ustawienia i Samouczek. Przy tylu przełącznikach na pasku
tytułu klikanie przestało się skalować.

- Bez wpisanej frazy paleta jest spisem treści aplikacji — pozycje w kolejności
  katalogu, z nagłówkami grup. Fraza włącza ranking rozmyty (`src/shared/fuzzy.ts`,
  ten sam co `Cmd+P`), a skróty klawiszowe są wyszukiwalne jako podpowiedź
  („cmd+b" znajduje przełącznik panelu bocznego) — bez podświetlania, bo trafienie
  poszło poza etykietę.
- Akcja panelu pokazuje sidebar, jeśli był schowany; „Wiedza" dodatkowo otwiera graf,
  tak samo jak klik w ikonę.
- Aktywny widok paska bocznego przeniesiony do `src/renderer/src/sidebar-view.ts`,
  bo zmienia go teraz i ikona, i paleta. Efekty uboczne zostają po stronie
  wywołującego — sklep pilnuje wyłącznie tego, który panel jest widoczny.
- Akcenty i skille świadomie poza paletą: akcenty są przy przełączniku motywu,
  a skille mają własny panel z filtrem i `Cmd+klik`.

## Poza zakresem v1 (świadome decyzje)

- **LSP** — `monaco-languageclient` istnieje, ale zarządzanie cyklem życia serwerów
  językowych i mapowaniem dokumentów to osobny projekt. Do rozważenia po M7 jako M8,
  najpierw dla jednego języka (TypeScript).
  *Rozstrzygnięcie: zostaje poza zakresem na stałe. Diagnostykę daje M71 przez
  `tsc` i `eslint`, bez cyklu życia serwerów językowych.*
- **Natywny czat zamiast pty** — przez `claude -p --output-format stream-json --verbose`
  dostajesz strumień JSON (jeden obiekt na linię, zaczynając od zdarzenia init),
  który można renderować własnym UI z prawdziwymi diffami zamiast tekstu w terminalu.
  Duży zysk wizualny, duży koszt. Dopiero gdy v1 działa i używasz go codziennie.
  *Rozstrzygnięcie: sprawdzone i odrzucone. Czat powstał, okazał się drugim
  interfejsem wejścia obok terminala i został usunięty w M28. Zysk wizualny bez tego
  kosztu dają M56 (oś czasu pracy) i `DiffView`. Nie wracać do tematu.*
- **Serwer `ide`** — rozszerzenie VS Code wystawia lokalny serwer MCP nazwany `ide`,
  do którego CLI podłącza się automatycznie; to dzięki niemu `claude` w terminalu
  otwiera diffy w natywnym viewerze edytora i widzi zaznaczony tekst. Serwer nasłuchuje
  na `127.0.0.1` na losowym porcie 10000–65535, zapisuje token do pliku blokady
  `~/.claude/ide/<port>.lock` (uprawnienia 0600), a klient musi go podać w nagłówku
  `X-Claude-Code-Ide-Authorization`. Twoja aplikacja mogłaby zaimplementować ten
  protokół i podszyć się pod IDE. Traktować jako eksperyment, nie fundament —
  to szczegół implementacyjny, który może się zmienić bez ostrzeżenia.
  *Rozstrzygnięcie: zrobione — `src/main/ide-server.ts` i `src/shared/ide-protocol.ts`.
  Nagłówek `X-Claude-Code-Ide-Authorization` i zmienna `CLAUDE_CODE_SSE_PORT` nadal są
  w binarce CLI 2.1.229, ale nadal nie są niczyim API — przy aktualizacji CLI to
  pierwsze miejsce do sprawdzenia.*

## Integracja z Obsidianem

Vault Obsidiana to katalog plików markdown — to jest fundament, na którym opierają
się wszystkie trzy warstwy. Robić je w kolejności; każda działa samodzielnie.

### Warstwa 1 — vault jako drugi korzeń drzewa (M8)

- Panel plików obsługuje wiele korzeni. Drugi korzeń („Notatki") wskazuje na katalog
  vaulta, ścieżka w ustawieniach aplikacji.
- Ukrywać `.obsidian/` i `.trash/`.
- Monaco otwiera `.md` normalnie; zapis na dysk, Obsidian podchwytuje zmianę sam.
- Frontmatter YAML notatki renderowany jako zwijany blok na górze pliku.

### Warstwa 2 — Claude z dostępem do vaulta przez MCP (M8)

Plugin **Local REST API** (coddingtonbear) ma wbudowany serwer MCP działający
wewnątrz Obsidiana, z dostępem do żywych metadanych vaulta, aktywnego pliku
i palety komend. Trzecioplanowe serwery pośredniczące (`mcp-obsidian` itp.)
nie są już potrzebne.

Konfiguracja:

```bash
claude mcp add --transport http obsidian http://127.0.0.1:27123/mcp/ \
  --header "Authorization: Bearer <klucz-z-ustawień-pluginu>"
```

- Domyślny endpoint to HTTPS na `127.0.0.1:27124/mcp/` z certyfikatem self-signed.
  Certyfikat można pobrać i zaufać z `https://127.0.0.1:27124/obsidian-local-rest-api.crt`,
  ale prościej włączyć zwykły HTTP na porcie 27123
  (Settings → Local REST API → Enable HTTP server) — ruch i tak nie opuszcza loopbacku.
- Klucz API: Settings → Local REST API w Obsidianie.
- **Serwer żyje tylko przy otwartym Obsidianie.** Panel MCP pokaże go wtedy jako
  niepołączony — to poprawne zachowanie, nie usterka. Warto dodać w panelu podpowiedź
  „Uruchom Obsidiana" przy serwerze o tej nazwie w stanie błędu.
- **Bezpieczeństwo:** to API daje pełny odczyt i zapis na wszystkich notatkach.
  Klucz trzymać poza repo — konfiguracja w scope `user` (`~/.claude.json`),
  nigdy w commitowanym `.mcp.json`.

Poza serwerem MCP plugin wystawia zwykły REST, przydatny do warstwy 3:
`GET /vault/<ścieżka>` czyta notatkę, `PATCH` z instrukcją JSON
(`targetType: "heading"`, `operation: "append"`) dopisuje treść pod konkretnym
nagłówkiem bez przepisywania pliku.

### Warstwa 3 — klej UX (zrobione w M36)

- Deep link `obsidian://open?vault=<nazwa>&file=<ścieżka>` — `Cmd+klik` na notatce
  w drzewie otwiera ją w prawdziwym Obsidianie zamiast w Monaco.
- Wikilinki `[[nazwa]]` jako klikalne dekoracje w Monaco. Uwaga: Obsidian rozwiązuje
  je po nazwie pliku w całym vaultcie, nie po ścieżce względnej — potrzebny indeks
  nazwa → ścieżka, budowany przy starcie i aktualizowany przez chokidar.
- Akcja „Wyślij do notatki dziennej": zaznaczenie w edytorze lub fragment transkryptu
  sesji Claude → `PATCH` pod wskazany nagłówek. Docelowy plik i nagłówek w ustawieniach.

## Wydanie na macOS (M9)

- **electron-builder**, target `dmg`, architektury `arm64` + `x64`.
- **`node-pty` jest modułem natywnym.** Uniwersalny binarny wymaga zbudowania go
  osobno pod każdą architekturę i sklejenia przez `lipo`. electron-builder to
  obsługuje, ale to najczęstsze miejsce, w którym build się wywraca — zweryfikować
  na obu architekturach, nie tylko na własnej maszynie.
- **App Sandbox: nie.** Aplikacja uruchamia dowolne procesy i sięga po pliki
  w całym systemie. To wyklucza dystrybucję przez Mac App Store — świadoma decyzja,
  nie ograniczenie do obejścia.
- **Podpisywanie:** dla wersji rozdawanej komukolwiek potrzebny certyfikat
  Developer ID Application (Apple Developer Program, 99 USD rocznie), hardened
  runtime oraz uprawnienia `com.apple.security.cs.allow-jit` i
  `com.apple.security.cs.allow-unsigned-executable-memory` (wymaga ich V8),
  a następnie notaryzacja przez `notarytool`.
- **Dla siebie:** v1 bez podpisu. Po instalacji zdjąć kwarantannę:
  `xattr -dr com.apple.quarantine /Applications/<App>.app`. Decyzję o podpisie
  odłożyć do momentu, w którym ktoś inny miałby tego używać.
- **Wygląd natywny:** `titleBarStyle: 'hiddenInset'` (kropki okna wpuszczone w pasek
  zakładek), vibrancy na sidebarze, menu aplikacji z `Cmd+,` otwierającym ustawienia,
  obsługa trybu jasnego i ciemnego przez `nativeTheme`.
- **Auto-update:** poza zakresem. Ręczna instalacja nowego `.dmg`.

## Znane ryzyka

1. **Środowisko powłoki.** Electron uruchomiony z Findera nie dziedziczy pełnego
   `PATH` z `~/.zshrc`. Efekt: `claude` lub `npm` „nie istnieją" w Twoich terminalach.
   Rozwiązać na starcie M3 (odczyt profilu shella przy inicjalizacji), nie później —
   inaczej będziesz to debugował przy każdym kolejnym kamieniu.
2. **Osierocone procesy pty.** Każdy `ptyId` musi być ubity przy zamknięciu zakładki
   i przy zamknięciu aplikacji. Test e2e na to w M3.
3. **Wydajność chokidar** na dużych repo — ograniczyć obserwowanie do rozwiniętych
   węzłów drzewa, nie całego projektu rekurencyjnie.
