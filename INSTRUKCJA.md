# Jak uruchomić Sufler

Krótki przewodnik od pobrania paczki do działającej aplikacji.

---

## Instalacja

Paczki instalacyjne znajdziesz w zakładce **Releases** na
[GitHubie](https://github.com/Luqys/Sufler/releases/latest).

### macOS

1. Pobierz plik `Sufler-<wersja>-arm64.dmg` (Apple Silicon: M1–M4)
   albo `-x64.dmg` (starsze Maki na Intelu). Menu  → *Ten Mac* podpowie,
   który procesor masz.
2. Otwórz `.dmg` i przeciągnij Sufler do katalogu **Programy**. W oknie
   obrazu leży też ta sama instrukcja w wersji tekstowej.
3. Aplikacja nie ma płatnego podpisu Apple Developer ID, więc przy pierwszym
   uruchomieniu system poprosi o potwierdzenie:

   - kliknij ikonę Sufler prawym przyciskiem (albo `Ctrl` + klik) →
     **Otwórz** → w oknie ostrzeżenia jeszcze raz **Otwórz**;
   - jeśli okno nie daje przycisku „Otwórz" (macOS Sequoia i nowsze):
     zamknij je, wejdź w *Ustawienia systemowe → Prywatność i ochrona*,
     przewiń na dół do komunikatu o zablokowanym Suflerze i kliknij
     **Otwórz mimo to**.

   Potwierdza się to raz — kolejne uruchomienia są zwykłym kliknięciem.

4. Gdyby system dalej odmawiał (komunikat „aplikacja jest uszkodzona"),
   zdejmij kwarantannę jedną komendą w Terminalu:

   ```bash
   xattr -dr com.apple.quarantine /Applications/Sufler.app
   ```

### Windows

1. Pobierz `Sufler-Setup-<wersja>-x64.exe` (albo `-arm64.exe` na maszynach
   z procesorem ARM).
2. Uruchom instalator. SmartScreen może pokazać ostrzeżenie o nieznanym
   wydawcy — kliknij **Więcej informacji** → **Uruchom mimo to**.
3. Wolisz bez instalacji? Pobierz wariant `-portable.exe` i uruchom go wprost.

---

## Zanim zaczniesz

Sufler jest nakładką na **Claude Code** — sam w sobie nie rozmawia z modelem.
Żeby sesje Claude i wskaźnik limitów działały, potrzebujesz:

- [Claude Code](https://claude.com/claude-code) zainstalowanego i dostępnego
  w `PATH` (sprawdź: `claude --version` w terminalu),
- zalogowanego konta — wystarczy raz uruchomić `claude` i przejść logowanie
  albo kliknąć ikonę ✳ na pasku tytułu w Suflerze,
- `git` (panel historii, punkty przywracania) i `ripgrep` (wyszukiwanie).
  Na macOS: `brew install git ripgrep`. Na Windows: `winget install Git.Git
  BurntSushi.ripgrep.MSVC`.

Bez Claude Code aplikacja też się uruchomi — dostaniesz edytor, terminale,
graf wiedzy i panele, tylko bez sesji asystenta.

---

## Pierwsze kroki w aplikacji

1. **Otwórz projekt** — ekran powitalny albo zębatka ⚙ → *Zmień folder
   projektu*. Lista ostatnich projektów pokazuje ikonę każdego z nich.
2. **Uruchom sesję Claude** — przycisk `+` w prawym albo dolnym doku →
   *Sesja Claude*. Obok, w tej samej zakładce, możesz otworzyć zwykły terminal.
3. **Zajrzyj do samouczka** — przycisk `?` na pasku tytułu opisuje wszystkie
   panele i skróty klawiszowe.
4. **Włącz dziennik sesji** — działa domyślnie i zapisuje przebieg pracy do
   katalogu `dziennik-sesji/`. Dzięki temu możesz spokojnie użyć `/clear`
   w Claude Code i wrócić do wątku, czytając jeden krótki plik.

### Przydatne skróty

| Skrót | Działanie |
|---|---|
| `Cmd/Ctrl + B` | pokaż/ukryj panel boczny |
| `Ctrl + \`` | pokaż/ukryj dolny dok |
| `Cmd/Ctrl + Shift + C` | pokaż/ukryj prawy dok |
| `Cmd/Ctrl + P` | szybkie otwieranie pliku po nazwie |
| `Cmd/Ctrl + S` | zapis pliku |
| `Cmd/Ctrl + ,` | ustawienia |

---

## Coś nie działa

**„claude: command not found" w zakładce sesji.** Claude Code nie jest w
`PATH` widzianym przez aplikację. Uruchom `claude --version` w zwykłym
terminalu; jeśli działa tam, a nie w Suflerze, zrestartuj aplikację — czyta
`PATH` z profilu powłoki przy starcie.

**Pigułka limitów pokazuje „limity —".** Nie ma zalogowanej sesji Claude Code
albo endpoint chwilowo odmawia. Kliknij ✳ na pasku tytułu i zaloguj się;
po przekroczeniu limitu zapytań aplikacja sama odczeka kilka minut.

**Panel historii jest pusty.** Folder projektu nie jest repozytorium git —
uruchom w nim `git init`, albo otwórz inny katalog.

**macOS: „aplikacja jest uszkodzona".** Kwarantanna po pobraniu z sieci.
Zdejmij ją komendą z sekcji [Instalacja](#macos).

---

Pełny opis funkcji: [README.md](README.md).
