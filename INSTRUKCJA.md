# Jak uruchomić Sufler

Krótki przewodnik od zera do działającej aplikacji. Jeśli chcesz tylko
zainstalować gotową paczkę, zacznij od sekcji [Gotowa
aplikacja](#gotowa-aplikacja). Jeśli chcesz uruchomić kod źródłowy albo coś
w nim zmienić — od [Uruchomienie ze źródeł](#uruchomienie-ze-źródeł).

---

## Gotowa aplikacja

Paczki instalacyjne znajdziesz w zakładce **Releases** na
[GitHubie](https://github.com/Luqys/Sufler/releases).

### macOS

1. Pobierz plik `Sufler-<wersja>-arm64.dmg` (Apple Silicon: M1–M4)
   albo `-x64.dmg` (starsze Maki na Intelu).
2. Otwórz `.dmg` i przeciągnij Sufler do katalogu **Programy**.
3. Aplikacja nie jest podpisana certyfikatem Apple, więc przy pierwszym
   uruchomieniu system ją zablokuje. Zdejmij kwarantannę jedną komendą
   w Terminalu:

   ```bash
   xattr -dr com.apple.quarantine /Applications/Sufler.app
   ```

   Alternatywnie: kliknij aplikację prawym przyciskiem → **Otwórz** →
   potwierdź **Otwórz** w oknie ostrzeżenia.

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

## Uruchomienie ze źródeł

### 1. Wymagania

- [Node.js](https://nodejs.org/) w wersji 20 lub nowszej
  (sprawdź: `node --version`)
- `git`

### 2. Pobranie i instalacja

```bash
git clone https://github.com/Luqys/Sufler.git
cd Sufler
npm install
```

Instalacja pobiera Electron i Monaco, więc pierwszy raz potrafi potrwać
kilka minut.

### 3. Start

```bash
npm run dev
```

Otworzy się okno z ekranem powitalnym. Wskaż folder projektu, nad którym
pracujesz — ten sam, w którym uruchamiasz Claude Code.

Tryb deweloperski odświeża interfejs po zapisaniu pliku. Zmiany w procesie
głównym (katalog `src/main`) wymagają restartu — zatrzymaj `Ctrl+C` i uruchom
ponownie.

### 4. Własna paczka instalacyjna

```bash
npm run dist:mac    # .dmg dla arm64 i x64
npm run dist:win    # instalator .exe i wersja przenośna
```

Gotowe pliki lądują w katalogu `dist/`. Paczkę dla danego systemu buduje się
na tym systemie — `.dmg` na macOS, `.exe` na Windowsie. Automat w
`.github/workflows/release.yml` robi jedno i drugie po oznaczeniu wydania
tagiem (`git tag v0.1.0 && git push --tags`).

---

## Pierwsze kroki w aplikacji

1. **Otwórz projekt** — ekran powitalny albo zębatka ⚙ → *Zmień folder
   projektu*.
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

**Terminal nie startuje na macOS (`posix_spawnp failed`).** Prebuilt node-pty
stracił bit wykonywalności. Napraw: `npm run postinstall`.

---

Pełny opis funkcji: [README.md](README.md).
Założenia projektowe: [docs/SPEC.md](docs/SPEC.md).
