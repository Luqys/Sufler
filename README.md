<div align="center">

<img src="build/icon-src/icon-macos-inset.svg" width="120" alt="Sufler">

# Sufler

**Podpowiada Claude'owi cały twój projekt.**

Środowisko pracy z Claude Code: edytor, prawdziwe terminale i sesje Claude
w jednym oknie — razem z grafem wiedzy, skillami i serwerami MCP.

[sufler.dev](https://sufler.dev/) · macOS i Windows · open source

</div>

![Sufler — graf wiedzy, drzewo projektu i terminal w jednym oknie](docs/obrazy/sufler.png)

## Czym to jest

Sufler pracuje na tym samym katalogu co Claude Code i pokazuje wszystko, co
asystent widzi po swojej stronie: skille, subagentów, reguły, serwery MCP
i notatki projektu. Zamiast przełączać się między edytorem, terminalem a czatem,
masz je obok siebie — a Claude dostaje pełny kontekst projektu, nie same
fragmenty wklejone do rozmowy.

Pliki zostają na dysku. Aplikacja niczego nie wysyła do sieci poza tym, co robi
samo Claude Code.

## Co potrafi

**Edytor i terminale.** Monaco z zakładkami i podglądem różnic, terminale na
`node-pty` i `xterm.js`. Karta terminala i karta sesji Claude to ta sama karta —
różni je wyłącznie komenda startowa. Karty dzielą się na panele, przenoszą
między dokami i wyjeżdżają do osobnych okien, nie restartując procesów.

**Graf wiedzy.** Notatki markdown połączone wikilinkami `[[…]]`, kolorowane
według autora, funkcji, warstwy, tagów albo świeżości. Do tego szukajka,
filtry legendy i ukrywanie notatek bez połączeń. Claude sięga po ten sam graf
narzędziami MCP, więc sam sprawdza, co jest z czym powiązane.

**Dziennik sesji.** Każda sesja zapisuje przebieg pracy do pliku markdown:
polecenia, edytowane pliki, komendy. Dzięki temu `/clear` przestaje boleć —
wracasz do wątku, czytając jeden krótki plik zamiast odtwarzać rozmowę.
Przycisk „Streść" prosi Claude o podsumowanie na górze dziennika.

**Punkty przywracania.** Przed każdą turą Claude aplikacja zapisuje migawkę
drzewa w osobnym refie gita — bez dotykania twoich commitów, gałęzi i indeksu.
Jedno kliknięcie cofa pliki do wybranego stanu; bieżący stan trafia najpierw do
nowej migawki, więc cofnięcie też da się cofnąć.

**Skille, agenci, reguły i slash-komendy.** Przegląd tego, co widzi Claude,
z przełącznikami włącz/wyłącz (zapisywanymi w `.claude/settings.local.json`)
i kreatorami nowych. Komendy z `.claude/commands` mają przestrzenie nazw
(`/frontend:build`), a `Cmd+klik` wstawia wywołanie do aktywnej sesji.
Sesje Claude mogą tworzyć skille same, przez MCP.

**Git bez wychodzenia do terminala.** Zaznaczasz zmienione pliki albo
pojedyncze fragmenty, piszesz opis i zatwierdzasz. Commit fragmentów idzie
przez tymczasowy indeks, więc to, co zastage'owałeś wcześniej, zostaje
nietknięte. Do tego worktree'y: kilka sesji Claude nad jednym zadaniem,
porównanie „co ta gałąź wniosła" i scalenie jednym kliknięciem.

**Problemy projektu.** `tsc` i `eslint` na żądanie — przycisk na pasku tytułu
uruchamia sprawdzenie i otwiera kartę z listą, z której klik skacze do linii.
Otwarte pliki dostają podkreślenia Monaco. Opcjonalnie po każdym zapisie,
z dławikiem. Bez serwerów językowych i bez trybu ciągłego.

**Paleta komend.** `Cmd+K` otwiera panele, doki, motywy, ustawienia
i przełącza projekty; `Cmd+P` szuka plików po nazwie.

**Historia sesji.** Rozmowy z Claude pogrupowane po dniach, z czasem, gałęzią
i szukajką — działającą także w **treści** rozmów, nie tylko w tytułach.
Zużycie tokenów liczone z transkryptów.

**Limity planu.** Zużycie okna 5-godzinnego i tygodnia prosto z tego samego
źródła, którego używa `/usage`, wraz z prognozą wyczerpania i ostrzeżeniem przy
wysokim zużyciu.

**Historia pracy.** Commity gita i dzienniki sesji na jednej osi czasu — widać,
która rozmowa doprowadziła do której zmiany.

**Reszta.** Serwery MCP ze stanem połączenia, wyszukiwanie ripgrepem, status git
w drzewie, import plików przeciągnięciem z Findera, integracja z Obsidianem,
motywy jasny, ciemny i matrixowy, interfejs po polsku i angielsku.

## Wymagania

- macOS albo Windows
- [Node.js](https://nodejs.org/) 20+
- [Claude Code](https://claude.com/claude-code) w `PATH` (sesje Claude i limity planu)
- `git` i `ripgrep` — dla panelu historii i wyszukiwania

## Instalacja

Gotowe paczki dla macOS (`.dmg`) i Windows (instalator `.exe` oraz wersja
przenośna) czekają w [Releases](https://github.com/Luqys/Sufler/releases).
Paczka macOS jest podpisana ad-hoc, więc przy pierwszym uruchomieniu system
poprosi o potwierdzenie — plik `START TUTAJ` w obrazie `.dmg` prowadzi krok
po kroku.

Ze źródeł:

```bash
git clone https://github.com/Luqys/Sufler.git
cd Sufler
npm install
npm run dev
```

Aplikacja startuje z ekranem wyboru folderu projektu. Wskaż katalog, w którym
pracujesz z Claude Code.

## Budowanie paczek

```bash
npm run dist:mac    # .dmg dla arm64 i x64
npm run dist:win    # instalator .exe (x64, arm64) i wersja przenośna
```

Paczkę dla danego systemu buduje się na tym systemie. Wydanie oznaczone tagiem
(`git tag v0.1.0 && git push --tags`) buduje oba warianty automatem
z `.github/workflows/release.yml`.

## Rozwój

| Komenda | Do czego |
|---|---|
| `npm run dev` | aplikacja w trybie deweloperskim (HMR) |
| `npm run typecheck` | TypeScript bez emisji |
| `npm run lint` | ESLint |
| `npm test` | testy jednostkowe (vitest) |
| `npm run e2e` | build + testy Playwright na zbudowanej aplikacji |

Zmiana jest gotowa, gdy wszystkie cztery komendy są zielone.

### Struktura

```
src/main       proces główny Electrona; index.ts to okno i rejestracja IPC,
               reszta w obszarach: claude/ project/ git/ knowledge/ skills/
               mcp/ window/ system/
src/preload    most contextBridge (window.api)
src/shared     typy i czysta logika współdzielona, testowana jednostkowo
               (claude/ docks/ editor/ git/ knowledge/ mcp/ skills/ project/
               system/ + ipc.ts i i18n/ jako kontrakty całej aplikacji)
src/renderer   interfejs w React — components/ z podziałem na dock, editor,
               sidebar, graph, dialogs, views, shell; styles/ w modułach
tests          testy jednostkowe (vitest), lustrzanie do src/shared
e2e            scenariusze Playwright pogrupowane: start dock editor panele
               wiedza ustawienia
build          ikony aplikacji wraz ze źródłami wektorowymi
docs           specyfikacja i decyzje projektowe
.github        automaty CI i wydań
```

Logika, którą da się przetestować bez Electrona, mieszka w `src/shared` —
procesy główny i renderer korzystają z niej wspólnie. Teksty interfejsu idą
wyłącznie przez słownik `src/shared/i18n/` (`pl.ts` i `en.ts`; typ wywodzi się
z polskiego, więc brak tłumaczenia zatrzymuje typecheck).

Wygląd trzymają trzy poziomy przycisku (`.btn-primary` — jedna akcja główna
na rząd, `.bar-btn` — cichy, `--danger` — destrukcyjny) i tokeny motywu
w `styles/01-podstawy.css`. Kolor stanu zapisany na sztywno zamiast tokenem
przestaje działać w motywie ciemnym i matrixowym.

Zrzut w README odświeża generator: `npx playwright test -c scripts/zrzut.config.ts`.

Decyzje projektowe i powody, dla których coś wygląda tak, a nie inaczej, są
w komentarzach przy kodzie i w opisach commitów. Konwencje pracy z asystentem:
[CLAUDE.md](CLAUDE.md).

## Licencja

[MIT](LICENSE) — rozwijane przez [N3O System](https://sufler.dev/).
Zbudowane na Electronie, React i TypeScripcie jako wsparcie dla Claude Code.
