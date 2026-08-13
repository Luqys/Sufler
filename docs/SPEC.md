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

Siedem kamieni z pierwszej listy (M68–M74) jest zrobionych — szczegóły w sekcjach
niżej. Poniżej następna, ułożona po tym, co widać po ich zrobieniu.

**Numeracja żyje w `git log`, nie tutaj.** Zanim weźmiesz numer, sprawdź:

```
git log --all --oneline | grep -oE '^[0-9a-f]+ M[0-9]+' | grep -oE 'M[0-9]+' | sort -u -t M -k2 -n
```

Stan na 2026-08-13: zajęte ciągiem M0–M63 oraz M66–M81, plus M82 w toku
(stabilność e2e). Wolne: M64, M65 (luki w środku, zostawić) i M83 w górę.

**Numer w tabeli poniżej jest propozycją, nie rezerwacją.** Sesja startująca
kamień bierze pierwszy wolny numer z komendy wyżej i poprawia tu wiersz —
inaczej backlog blokuje numery na pracę, która może nigdy nie ruszyć, a kolejna
sesja i tak weźmie numer z gita. Tak powstało M80: wiersze przesunęły się o jeden,
bo numer wziął panel „Sesje".

| # | Zakres | Sprawdzenie |
|---|---|---|
| ~~M83~~ | ~~Wyszukiwanie w treści transkryptów sesji, nie tylko w tytułach~~ (zrobione) | test jedn.: `tests/claude/transcript-search.test.ts`; e2e: `e2e/panele/m83-szukanie-rozmow.spec.ts` |
| ~~M90~~ | ~~Diagnostyka po zapisie — opcjonalna, dławiona, z filtrem listy problemów~~ (zrobione, numer M84 wzięła inna sesja) | test jedn.: `tests/editor/diagnostics-auto.test.ts`; e2e: `e2e/editor/m90-diagnostyka-zapis.spec.ts` |
| ~~M85~~ | ~~Commit po kawałkach — zaznaczanie fragmentów pliku~~ (zrobione) | test jedn.: `tests/git/hunks.test.ts`, `tests/git/hunk-commit.test.ts`; e2e: `e2e/panele/m85-fragmenty.spec.ts` |
| ~~M86~~ | ~~Diff worktree ↔ gałąź bazowa — dokończenie M72~~ (zrobione) | test jedn.: `tests/git/branch-diff.test.ts`; e2e: `e2e/panele/m86-worktree-diff.spec.ts` |
| ~~M87~~ | ~~Przełącznik projektów w palecie `Cmd+K` z ostatnimi korzeniami~~ (zrobione) | test jedn.: `tests/project/recent-projects.test.ts`; e2e: `e2e/ustawienia/m87-projekty-paleta.spec.ts` |
| ~~M88~~ | ~~Wydajność na dużym repozytorium — pomiar i twarde limity~~ (zrobione) | test jedn.: `tests/project/limits.test.ts`; e2e: `e2e/panele/m88-duze-repo.spec.ts` |

Kolejność sensowna, nie obowiązkowa: M83 i M84 są tanie i domykają rzeczy zaczęte
(panel Sesje, pasek diagnostyki). M85 i M88 to jedyne dwa duże kamienie na tej liście.

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

### M92 — panel mówi, co jest USTAWIONE (zrobione)

Panel z M84 umiał tylko przełączać. Po kliknięciu nie było wiadomo, co
właściwie obowiązuje, a po `--resume` albo po zmianie z klawiatury panel
i sesja rozjeżdżały się w milczeniu — najgorszy rodzaj interfejsu, bo wygląda
na źródło prawdy, a nim nie jest.

Stan czytamy z WYJŚCIA sesji, nie z własnych kliknięć: CLI wypisuje model
i głębokość myślenia w nagłówku (`Opus 5 (1M context) with xhigh · …`)
i potwierdza zmianę osobnym wierszem (`Set model to sonnet`). Parser
(`src/shared/claude/session-header.ts`) bierze pod uwagę OSTATNIE wystąpienie,
bo w trakcie sesji potwierdzenie ma pierwszeństwo nad nagłówkiem startowym,
a pola bez trafienia zostają puste — panel nie zgaduje, tylko mówi „jeszcze
nieznane".

Przy okazji sprzątanie: `src/shared/claude/usage.ts` żył wyłącznie dzięki
własnemu testowi (żaden moduł produkcyjny go nie importował), a jego
formatowanie miało ZASZYTE polskie skróty („tys.", „mln") — w dwujęzycznej
aplikacji byłby to błąd. Produkcja używa `Intl.NumberFormat` z lokalizacją.
Moduł i test usunięte.

### M91 — aparatura do polowania na migotanie (zrobione)

Po M82 migotanie jest rzadkie (1–2 na 130 uruchomień), ale nie zniknęło,
a dwa WYŁĄCZNE przebiegi na sąsiednich commitach dały 2 flaki i 0 flak. Czyli
pojedynczy przebieg nie rozstrzyga niczego, a kolejne hipotezy byłyby tak samo
nieweryfikowalne jak dwie poprzednie — „zombie procesy" i „dławienie tła" —
obie postawione i obie wycofane po sprawdzeniu.

Reporter (`e2e/reporter-flaki.ts`) dopisuje wiersz TSV dla KAŻDEJ nieudanej
próby, także tej naprawionej przez retry, z przyczyną w jednej z rozłącznych
klas: `start-okna`, `tresc`, `widocznosc`, `liczba`, `inne`. Każda prowadzi
gdzie indziej: brak okna to start procesu, treść to bajty albo render,
widoczność to układ albo fokus. Zapis idzie do `e2e-artifacts/` (poza repo),
więc serię kilkunastu przebiegów da się policzyć bez parsera.

**Próbowane i odrzucone:** zapis surowych bajtów pty w atrapie `claude`
(`tee` przed `cat -v`), żeby rozdzielić „nie doszło" od „nie narysowało się".
Wstawienie potoku przenosi wejście `cat` z terminala na potok, a wtedy wypisuje
on blokowo zamiast na bieżąco — scenariusz m66 zaczął padać powtarzalnie.
Pomiar nie może zaburzać tego, co mierzy; zostawiony komentarz w `e2e/utils.ts`
mówi to wprost, żeby ktoś nie spróbował drugi raz.

Aparatura nie odpowiada jeszcze na pytanie „dlaczego" — do tego potrzeba serii
kilkunastu przebiegów, czyli około godziny pracy maszyny. Po to jednak jest:
serię może puścić ktokolwiek i kiedykolwiek, a wynik będzie rozkładem, nie
anegdotą.

### M90 — diagnostyka po zapisie (zrobione)

Ostatnia pozycja z backlogu po v1. Miała numer M84 i wypadła, gdy ten numer
wzięła inna sesja — dokładnie tak, jak przewiduje reguła „numer w tabeli jest
propozycją, nie rezerwacją".

Pasek z M71 sprawdzał projekt wyłącznie na żądanie. Zapis pliku to najczęstszy
moment, w którym chce się wiedzieć, czy projekt nadal się kompiluje — ale
sprawdzanie po KAŻDYM `Cmd+S` byłoby gorsze niż brak sprawdzania: `tsc` na tym
repozytorium trwa kilkanaście sekund, a zapisy idą seriami.

- Przełącznik „po zapisie" w pasku, **domyślnie wyłączony**, stan w `state.json`.
- Dławik dwustopniowy: seria zapisów daje jeden przebieg (przerwa 1,2 s), a kolejny
  nie ruszy szybciej niż 5 s po poprzednim. Trwający przebieg nie dokłada kolejki —
  jego wynik i tak będzie świeży.
- Filtr listy problemów (po ścieżce, treści i kodzie reguły, bez ogonków
  i wielkości liter) plus „tylko błędy". Przy kilkudziesięciu ostrzeżeniach
  `eslint` to jedyna droga do trzech błędów `tsc`.
- Sygnałem jest licznik udanych zapisów z `workspace`, nie podsłuchiwanie
  klawiatury — zapis wywołany z menu albo z paska liczy się tak samo.

### M89 — okna bez dławienia w tle (zrobione)

Trop z migotania `m35-hooki`: żadne z trzech okien aplikacji nie ustawiało
`backgroundThrottling: false`. Chromium dławi w oknie nieaktywnym albo
zasłoniętym timery i `requestAnimationFrame` — a na tym drugim stoi renderer
xterma. Dla aplikacji, w której odczepia się okno WŁAŚNIE PO TO, żeby patrzeć
na sesję Claude obok innej pracy, to zachowanie jest wprost przeciwskuteczne.

Wspólne `webPreferences` wszystkich okien siedzą teraz w jednej funkcji
(`src/main/window/preferences.ts`), bo różnica między nimi sprowadzała się do
jednej flagi, a rozjazd kosztowałby ciszej, niż widać.

**Czego NIE wykazano — i dlaczego test wygląda inaczej, niż powinien.**
Pierwszą wersją był scenariusz e2e: odczepiony terminal miał pokazać wynik
polecenia, gdy okno jest w tle. Sprawdzenie, czy potrafi paść BEZ naprawy,
dało **3/3 zielone z wyłączoną flagą** — czyli scenariusz nie badał niczego.
Powód jest mechaniczny: Playwright czyta DOM i omija tor rysowania, a okno
„w tle" na pulpicie nie jest realnie zasłonięte, więc Chromium go nie dławi.
Scenariusz skasowano, a w zamian stoi test jednostkowy pilnujący flagi przed
cichym usunięciem — broni ustawienia i nie udaje, że bada zachowanie.

Ustawienie zostaje, bo jest poprawne dla aplikacji terminalowej, ale **nie ma
dowodu, że usuwa migotanie `m35`**. Ta hipoteza została wycofana, zanim weszła
do dokumentacji jako fakt.

### M88 — wydajność na dużym repozytorium (zrobione)

Najpierw pomiar, potem limity. Repozytorium wygenerowane do próby: 25 000 plików
w 250 katalogach plus katalog `dane/` z 20 000 wpisów i `node_modules` do
zignorowania.

| Operacja | Koszt |
|---|---|
| `readdir` 20 000 wpisów | 26 ms |
| `git check-ignore` 200 / 1000 / 2000 / 5000 / 20 000 ścieżek | 24 / 48 / 87 / 220 / 810 ms |
| `rg --files` 25 000 plików (ścieżką aplikacji, `ARGV0=rg`) | 64 ms |
| `git status --porcelain` | 30 ms |
| chokidar: 250 katalogów | 257 ms |
| chokidar: jeden katalog z 20 000 wpisów | 749 ms |

**Wąskie gardło jest jedno i nie tam, gdzie zakładałem.** `rg` i `git status`
są niewinne — mit „na dużym repo szukanie zamula" pomiar obalił. Kosztuje
`git check-ignore`, wołany przy KAŻDYM rozwinięciu katalogu, i rośnie liniowo
z liczbą wpisów.

- **Limit 2000 wpisów na katalog**, przycinanie PRZED zapytaniem gita — w tym
  tkwi cały zysk (87 ms zamiast 810 ms). Drzewo mówi wprost, ile wpisów ukryto,
  zamiast po cichu pokazywać niepełną listę.
- **Limit 200 obserwowanych katalogów**, z zachowaniem OSTATNICH: lista przychodzi
  w kolejności rozwijania, więc katalog, na którym człowiek właśnie pracuje,
  zawsze zostaje obserwowany.
- Pomiar `check-ignore` z pierwszego podejścia (3,3 s dla 20 000) był **zawyżony**,
  bo puściłem dwa procesy równolegle; czysty pomiar to 810 ms. Zapisane, bo liczba
  z równoległego przebiegu trafiła najpierw do notatek.
- Progi siedzą w `src/shared/project/limits.ts` razem z tabelą pomiarów — kto
  będzie je zmieniał, zobaczy, skąd się wzięły.

### M87 — projekty w palecie komend (zrobione)

Przełączenie projektu wymagało powrotu na ekran startowy albo wycieczki do
Ustawień, choć przy pracy nad kilkoma repozytoriami to jedna z najczęstszych
czynności. `Cmd+K` ma teraz grupę „Projekty": ostatnio otwarte korzenie plus
„Otwórz inny projekt…".

- Przełączenie idzie tą samą drogą co wybór z ekranu startowego
  (`setProjectRoot` → reset grup edytora → nowy korzeń), więc dzieje się
  **w tym samym oknie**, bez restartu aplikacji.
- Bieżący projekt wypada z listy — wpis prowadzący donikąd tylko zajmowałby
  miejsce. Porównanie znosi końcowe ukośniki, żeby ten sam katalog zapisany
  na dwa sposoby nie przeszedł.
- Podpowiedź przy nazwie to skrócony katalog nadrzędny (`~` zamiast katalogu
  domowego, `…/rodzic`), bo dwa projekty często nazywają się tak samo, a pełna
  ścieżka nie mieści się w palecie.
- Lista ostatnich projektów zapełnia się dopiero jawnym przełączeniem —
  uruchomienie z `VISUALN3O_ROOT` jej nie dotyka. Scenariusz e2e wpisuje ją
  wprost do `state.json`, tak samo jak inne spece podstawiają motyw.

### M86 — diff worktree ↔ gałąź bazowa (zrobione)

Dokończenie M72. Wiersz worktree'a ma przycisk `±`, który rozwija listę plików
wniesionych przez tę gałąź; klik w plik otwiera zwykłą zakładkę diffa.

- **Sprostowanie do M72:** napisałem tam, że to wymaga diffa „między katalogami
  roboczymi" i dlatego wypada z zakresu. To nieprawda — gałąź worktree'a widać
  z korzenia projektu jak każdą inną (`git diff baza...gałąź` działa), a istniejący
  deskryptor `kind: 'commit'` obsługuje dowolne rewizje. Kamień kosztował
  kilkanaście minut zamiast osobnego projektu.
- Liczymy od **punktu rozejścia** (`git merge-base`), nie od czubka bazy. Inaczej
  praca, która w międzyczasie weszła na gałąź projektu, pokazywałaby się jako
  wkład worktree'a i porównanie kłamałoby o tym, co ten katalog wniósł. Test
  jednostkowy pilnuje dokładnie tego przypadku.
- Format `--name-status -z`: ścieżki ze spacjami i cudzysłowami nie wymagają
  odcytowywania, a zmiana nazwy niesie starą i nową ścieżkę.
- Plik dodany na gałęzi nie ma strony „przed" — zakładka dostaje `parent: null`
  i pokazuje pustą lewą stronę zamiast błędu.
- Liczone na żądanie, po rozwinięciu wiersza; panel nie liczy różnic dla
  wszystkich worktree'ów przy otwarciu.
- Zakładka diffa dostaje **sha czubka gałęzi**, nie jej nazwę. `runGitShowFile`
  przepuszcza wyłącznie `HEAD` i sha — to zabezpieczenie przed wstrzyknięciem do
  `git show <rev>:<ścieżka>` i nie ma powodu go luzować; zamiast tego gałąź
  rozwiązujemy do sha po stronie liczącej różnicę. Przy okazji porównanie zostaje
  przypięte do rewizji, którą faktycznie policzyliśmy, a nie do ruchomej gałęzi.
- Rozróżniamy „nie da się porównać" (null z IPC: odłączona baza, zniknięta gałąź)
  od „nic jeszcze nie wniosła" (pusta lista). Wspólny komunikat kłamałby
  uspokajająco w razie awarii.

### M84 — sterowanie sesją Claude z paska karty (zrobione)

Zgłoszenie: „chcę wycisnąć z Claude wszystko" plus przycisk przenoszący
rozmowę. Karta `claude` ma teraz w pasku przycisk otwierający panel sterowania.

**Wartości wzięte z CLI, nie zgadnięte** (`claude --help`, wersja 2.1.231,
sprawdzone też w binarce): `/model`, `/effort` (low, medium, high, xhigh, max),
`/compact`, `/clear`, `/mcp`, `/login`. Tryb uprawnień jako jedyny NIE ma
komendy — CLI przełącza go wyłącznie cyklicznie shift+tabem, więc przycisk
wysyła `CSI Z` (`\u001b[Z`). Każda komenda idzie do pty TEJ karty razem
z Enterem; bez niego wpis zawisłby w polu wejściowym.

**Przeniesienie rozmowy do nowej sesji z kontekstem.** Świeża sesja startuje
pusta, więc kontekst niesie dziennik sesji (M52) ze streszczeniem (M54):
przycisk bierze najświeższy dziennik projektu, streszcza go i otwiera nową
kartę z poleceniem „przeczytaj @dziennik-sesji/…, streść w trzech zdaniach, na
czym stanęliśmy, i czekaj — nie zaczynaj pracy sam". Brak dziennika kończy się
komunikatem, a nie pustą sesją z obietnicą kontekstu.

Prompt wjeżdża dopiero, gdy CLI zgłosi gotowość — nasłuch na strumieniu pty
tą samą heurystyką, co wskaźnik statusu (M4). Wpis wysłany wcześniej wpadłby
w pustkę, zanim powstanie pole wejściowe.

Scenariusz e2e sprawdza BAJTY, które poszły do pty (atrapa `claude` zapisuje
całe wejście przez `tee`), a nie to, co pokazał terminal — dzięki temu test
łapie różnicę między „widać na ekranie" a „sesja dostała".

### M85 — commit po kawałkach (zrobione)

W M69 zaznaczenie było per plik, a stage'owanie fragmentów zapisałem jako
„osobną mechanikę, jeśli w ogóle". Tym razem uzasadnienie się obroniło: to
naprawdę osobna mechanika, bo commit części pliku wymaga commitowania indeksu,
a aplikacja ma zasadę, że nie rusza indeksu pod palcami pracującego człowieka.

- Rozwiązanie: **tymczasowy indeks**, tą samą techniką co punkty przywracania
  (M55) — `GIT_INDEX_FILE` → `read-tree HEAD` → łatki wybranych hunków
  (`git apply --cached`) → `write-tree` → `commit-tree` → `update-ref HEAD`.
  HEAD dostaje dokładnie zaznaczone fragmenty, drzewo robocze zostaje nietknięte,
  a cudze zastage'owane pliki zostają w indeksie.
- **Jedno ustępstwo wymuszone testem:** po takim commicie indeks użytkownika
  trzeba zrównać z nowym HEAD **dla zatwierdzonych ścieżek**. Bez tego trzyma
  treść sprzed commita i `git status` pokazuje zmianę w obie strony (odwrotny
  diff w indeksie). Test pilnuje, że pliki zastage'owane osobno zostają nietknięte.
- Składając łatkę, przeliczamy początek strony „po" o pominięte hunki. Bez tego
  `git apply` odrzuca wszystko od drugiego fragmentu — test nakłada sam drugi hunk.
- Hunki liczymy wobec **HEAD**, nie wobec indeksu: łatka ma się nakładać na
  zawartość, od której startuje tymczasowy indeks.
- Zaznaczenie fragmentu automatycznie odznacza cały plik — inaczej commit wziąłby
  i tak całą zawartość, a zaznaczenie kawałków byłoby ozdobą.
- Pliki nieśledzone i binarne nie mają przycisku fragmentów; nie ma czego dzielić.
- Droga z M69 (`git commit -- <ścieżki>`) zostaje dla samych całych plików —
  działa też w repozytorium bez HEAD, gdzie nie ma z czego zbudować indeksu.

### M83 — szukanie w treści rozmów (zrobione)

Filtr w panelu „Sesje" (M80) zawężał tytuły i gałęzie, czyli pierwsze polecenie
i nic więcej. Pytanie „gdzie ja o tym rozmawiałem" wymagało otwierania sesji po
kolei. Teraz ta sama szukajka ma drugą warstwę: sekcja „W treści rozmów" pokazuje
sesje, w których fraza faktycznie padła, z wycinkiem i podświetleniem.

- Skaner jest **strumieniowy** i karmiony linia po linii — transkrypty sięgają
  dziesiątek megabajtów. Pliki idą od najnowszego i przerywamy po dwunastu
  sesjach z trafieniami; panel ma dawać trop, nie wypisywać historii.
- Szukanie rusza dopiero od trzech znaków i po przerwie w pisaniu (350 ms),
  inaczej każdy znak startowałby przemiał wszystkich transkryptów.
- Bez ogonków i wielkości liter („galezi" znajduje „gałęzi"). Wycinek tniemy po
  znormalizowanej treści, ale wypisujemy z oryginału — inaczej podgląd gubiłby
  ogonki.
- Pomijamy wpisy meta, opakowania komend lokalnych (`<command-name>…`) i ruch
  subagentów: wyszukiwanie nie może znajdować rzeczy, których w rozmowie nie widać.
- Limit trafień na sesję (3) **liczy resztę** zamiast ją gubić — „+5 dalszych
  trafień w tej rozmowie".
- Klik w wynik rozwija tę rozmowę na liście i dociąga jej szczegóły, nawet jeśli
  filtr tytułów jej nie pokazuje.
- Komunikat pustego filtra mówi wprost o tytule i gałęzi, żeby nie zaprzeczał
  trafieniom pokazanym wyżej.

### M81 — audyt i reorganizacja drzewa (zrobione)

Katalogi rosły płasko: `src/shared` 50 plików, `src/main` 41, `components` 38,
`e2e` 68 — wszystko w jednym poziomie, a `styles.css` i `i18n.ts` spuchły do
4576 i 1334 linii. Audyt najpierw, przenosiny potem.

**Co pokazał audyt.** Zero martwych modułów — każdy plik źródłowy jest
importowany. Z 541 kluczy słownika 15 nie miało dosłownego użycia, ale 12 z nich
składa się dynamicznie (`accent.*`, `theme.*`, `settings.hookLayer.*`); naprawdę
martwe były trzy (`usage.dayTitle` po usunięciu wykresu w M77, `welcome.newTitle`
i `welcome.newGitFailed` z M76) i tylko te wypadły.

**Nowa siatka — ta sama w każdej warstwie:**

| Warstwa | Podział |
|---|---|
| `src/shared` | `claude/`, `docks/`, `editor/`, `git/`, `knowledge/`, `mcp/`, `skills/`, `project/`, `system/`; `ipc.ts` i `i18n/` zostają na wierzchu jako kontrakty |
| `src/main` | `claude/`, `project/`, `git/`, `knowledge/`, `skills/`, `mcp/`, `window/`, `system/`; `index.ts` to okno + rejestracja IPC |
| `components` | `dock/`, `editor/`, `sidebar/`, `graph/`, `dialogs/`, `views/`, `shell/` |
| `tests` | lustrzanie do `src/shared` |
| `e2e` | obszarami: `start/`, `dock/`, `editor/`, `panele/`, `wiedza/`, `ustawienia/` (numer kamienia zostaje w nazwie pliku) |

**Rozbicia.** `i18n.ts` → `i18n/{pl,en,klucze,index}.ts`: teksty osobno,
`StringKey` wciąż wywodzi się z PL, więc typ nadal wymusza komplet tłumaczeń.
`styles.css` → spis treści plus osiem modułów w `styles/`; podział jest
**sekwencyjny**, po granicach istniejących sekcji, bo kaskada zależy od
kolejności — moduły importują się dokładnie w tej, w której stały reguły.

**Pułapka do zapamiętania:** `e2e/m51-ikona.spec.ts` liczył korzeń repozytorium
jako `join(__dirname, '..')`. Po zejściu o katalog głębiej spec zaczął szukać
`build/icon.png` w `e2e/` i to jedyna realna szkoda, jaką zrobiły przenosiny —
złapało ją pełne e2e. Przy każdej zmianie układu katalogów sprawdzić
`grep -rn "__dirname" e2e/ scripts/`.

Przenosiny szły `git mv` (historia plików zostaje), a importy przepisał skrypt
rozwiązujący każdy import względny do ścieżki w repo i liczący go na nowo
z nowej lokalizacji: 233 przeniesione pliki, 205 z przepisanymi importami.

### M80 — lista sesji do przeglądania, nie do przewijania (zrobione)

Panel „Sesje" pokazywał pięćdziesiąt jednakowych wierszy z czasem względnym
(„12 min temu / 2 godz. temu / 11 godz. temu") i tematami wziętymi z pierwszego
polecenia — a te często zaczynają się od wklejonej ścieżki zrzutu ekranu.
Efekt: nie dało się ani wrócić do wczorajszej pracy, ani znaleźć rozmowy.

- **Grupy dni** z lepkimi nagłówkami: „Dziś", „Wczoraj", dalej data z dniem
  tygodnia, każda z licznikiem. Podział idzie po dacie lokalnej, nie po dobie
  wstecz — rozmowa z 00:30 należy do dziś, nie do wczoraj.
- **Szukajka** nad listą: po widocznej etykiecie, po gałęzi i po surowym tytule,
  więc wklejona ścieżka nadal jest do znalezienia, choć nie widać jej na liście.
  Bez ogonków i wielkości liter („galaz" znajdzie „gałąź").
- **Wiersz w dwóch liniach**: temat dostaje całą szerokość, pod nim godzina,
  gałąź i kropka „sprzed chwili" przy rozmowach z ostatnich dziesięciu minut.
  Czas trwania i pełna data siedzą w podpowiedzi godziny — trzeci fakt w linii
  zjadał nazwę gałęzi przy szerokości paska bocznego. Rozmiar transkryptu wypadł
  zupełnie: w bajtach nie mówił nic o rozmowie.
- Chevron zniknął — stan rozwinięcia niesie tło i pasek akcentu, a zwolnione
  miejsce dostał temat.
- Logika w `src/shared/session-groups.ts` (grupowanie, filtr, czas trwania),
  wygląd w `SessionsPanel.tsx`.

### M79 — dodawanie serwera MCP z aplikacji (zrobione)

Panel MCP tylko czytał: konfigurację z plików i stan z `claude mcp list`. Nowy
serwer trzeba było dopisać w terminalu albo ręcznie w JSON-ie. Teraz w pasku
panelu jest „+", a kreator ma dokładnie te pola, które przyjmuje CLI: nazwę,
transport (HTTP / SSE / lokalny stdio), adres albo komendę, nagłówki i zakres.

Zapis idzie przez **`claude mcp add`**, nie przez własne pisanie do `.mcp.json`
i `~/.claude.json`. Powód: to CLI zna układ pól i zakresów, a aplikacja i tak
czyta stan z `claude mcp list` — samodzielny zapis oznaczałby dwa źródła prawdy
i cichą rozbieżność przy zmianie formatu. Tą samą drogą aplikacja rejestruje
własny serwer `wiedza-graf` (M20).

Rozstrzygnięcia warte zapamiętania:

- **Komenda stdio idzie po `--`**, inaczej jej własne flagi (`-y`, `--port`)
  zjadłoby CLI. Podział na argumenty szanuje cudzysłowy.
- **Nagłówki wpisuje się po jednym w wierszu** (`Nazwa: wartość`); wiersz bez
  dwukropka wraca jako błąd, zamiast po cichu zgubić token uwierzytelniający.
- **Zakres ma zdanie wyjaśniające pod polem** — różnica między `.mcp.json`
  (widzi zespół) a `~/.claude.json` (widzę ja, we wszystkich projektach) jest
  nieoczywista, a myłka kosztuje wyciek tokenu do repozytorium.
- Po dodaniu main rozgłasza `mcp:changed`, bo zakres `user` zapisuje plik poza
  projektem, którego obserwator drzewa nie widzi.

Czysta logika (walidacja, budowa argumentów) w `src/shared/mcp-add.ts`; e2e
przechodzi całą drogę na atrapie CLI, która zapisuje otrzymane argumenty.

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

### M72 — worktree'y (zrobione)

Praca kilkoma sesjami naraz odbywała się poza aplikacją: `git worktree add`
w terminalu, druga instancja Suflera, ręczne scalanie. Panel Git ma teraz sekcję
„Worktree'y" — listę katalogów roboczych z gałęziami i formularz nazwy.

- Sufler robi `git worktree add -b <nazwa>` **sam**, zamiast używać
  `claude --worktree`: tam katalog wybiera CLI, a drzewo plików i panel Git nie
  wiedzą o nowym korzeniu.
- Katalog powstaje **obok** projektu (`<korzeń>-worktrees/<nazwa>`), nigdy w środku
  — inaczej chokidar, drzewo plików i `rg` widziałyby kopię repozytorium
  w repozytorium. Ukośnik w nazwie gałęzi nie tworzy zagnieżdżeń.
- Zaraz po utworzeniu startuje w nim sesja Claude (`AddTabOptions.cwd`, dołożone
  w tym kamieniu) — po to się ten katalog zakłada.
- „Scal" to `git merge --no-ff --no-edit` w katalogu głównym. **Konflikt kończy się
  przerwaniem** (`merge --abort`) i komunikatem: rozwiązywanie zostaje przy
  człowieku w terminalu, żaden automat nie dotyka cudzych zmian.
- Usunięcie pyta o zgodę i idzie bez `--force`; worktree z niezapisanymi zmianami
  zostaje nietknięty wraz z osobnym komunikatem. Gałąź zostaje zawsze.
- Logika w `src/shared/git/worktrees.ts` (parser `--porcelain`, walidacja nazw,
  ścieżki), operacje w `src/main/git/worktrees.ts`.
- **Poza zakresem tego kamienia** był widok porównawczy diff worktree ↔ gałąź
  bazowa. Uzasadnienie, które tu wpisałem („`DiffView` porównuje rewizje jednego
  repozytorium, a tu potrzebny jest diff między katalogami roboczymi"), **było
  błędne** — gałąź worktree'a jest zwykłą gałęzią tego samego repozytorium.
  Zrobione w M86 kilkanaście minut później, przy użyciu istniejącej zakładki diffa.

### M71 — diagnostyka bez LSP (zrobione)

Edytor bez podkreślonych błędów jest notatnikiem. Pełne LSP zostaje poza zakresem
(patrz niżej); tańszy substytut daje większość zysku. Pod edytorem jest pasek
z przyciskiem „Sprawdź projekt", licznikami błędów i ostrzeżeń oraz listą,
z której klik otwiera plik na właściwej linii; otwarte bufory dostają falki Monaco.

- `tsc --noEmit --pretty false` i `eslint . --format json` uruchamiane
  **na żądanie**, jednym przebiegiem. Trybu `--watch` świadomie nie ma: na dużym
  repo to stały koszt CPU, a pasek i tak odpowiada wtedy, kiedy człowiek pyta.
- Binarki biorą się z `node_modules/.bin` projektu, nie z globalnej instalacji —
  wersja ma się zgadzać z repozytorium. Brak narzędzia jest **powiedziany wprost**
  („eslint nie wystartował"), zamiast udawać czysty projekt.
- Niezerowy kod wyjścia obu narzędzi to normalna droga, gdy znajdą błędy — liczy
  się stdout, nie status.
- Podkreślenia malują się też na plikach otwartych PO przebiegu (model Monaco
  powstaje dopiero przy otwarciu, więc jednorazowe malowanie pomijało dokładnie
  te pliki, do których skacze się z listy).
- Komendy da się podmienić przez `VISUALN3O_DIAG_TSC` i `VISUALN3O_DIAG_ESLINT` —
  e2e podstawia atrapy z zamrożonym wyjściem zamiast ciągnąć toolchain do
  katalogu tymczasowego.
- Parser w `src/shared/diagnostics.ts`, testy na zamrożonych fixture'ach wyjścia obu
  narzędzi. Format `tsc` zmienia się między wersjami — ten sam reżim co parser `mcp list`.
- Wynik jako `monaco.editor.setModelMarkers` plus licznik w pasku pod edytorem.
- **To jest granica zakresu.** Jeśli w trakcie pojawi się pokusa autouzupełniania
  albo „idź do definicji", to sygnał z sekcji „Cel", a nie materiał na kolejny kamień.

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
