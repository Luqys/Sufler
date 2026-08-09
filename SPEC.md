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

## Poza zakresem v1 (świadome decyzje)

- **LSP** — `monaco-languageclient` istnieje, ale zarządzanie cyklem życia serwerów
  językowych i mapowaniem dokumentów to osobny projekt. Do rozważenia po M7 jako M8,
  najpierw dla jednego języka (TypeScript).
- **Natywny czat zamiast pty** — przez `claude -p --output-format stream-json --verbose`
  dostajesz strumień JSON (jeden obiekt na linię, zaczynając od zdarzenia init),
  który można renderować własnym UI z prawdziwymi diffami zamiast tekstu w terminalu.
  Duży zysk wizualny, duży koszt. Dopiero gdy v1 działa i używasz go codziennie.
- **Serwer `ide`** — rozszerzenie VS Code wystawia lokalny serwer MCP nazwany `ide`,
  do którego CLI podłącza się automatycznie; to dzięki niemu `claude` w terminalu
  otwiera diffy w natywnym viewerze edytora i widzi zaznaczony tekst. Serwer nasłuchuje
  na `127.0.0.1` na losowym porcie 10000–65535, zapisuje token do pliku blokady
  `~/.claude/ide/<port>.lock` (uprawnienia 0600), a klient musi go podać w nagłówku
  `X-Claude-Code-Ide-Authorization`. Twoja aplikacja mogłaby zaimplementować ten
  protokół i podszyć się pod IDE. Traktować jako eksperyment, nie fundament —
  to szczegół implementacyjny, który może się zmienić bez ostrzeżenia.

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

### Warstwa 3 — klej UX (poza v1, do rozważenia po M9)

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
