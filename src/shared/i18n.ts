import type { Language } from './appearance';

/**
 * Słownik tekstów UI. Polski (PL) jest źródłem prawdy dla zestawu kluczy;
 * typ EN wymusza kompletność tłumaczenia w typecheck. Placeholdery {nazwa}
 * podstawia tf() z renderera.
 */

export const PL = {
  // Wspólne
  'common.cancel': 'Anuluj',
  'common.ok': 'OK',
  'common.close': 'Zamknij',
  'common.closeTab': 'Zamknij zakładkę',

  // Pasek tytułu
  'titlebar.login': 'Zaloguj się do konta Claude (otwiera `claude /login`)',

  // Sidebar
  'sidebar.aria': 'Widoki panelu bocznego',
  'sidebar.rail.files': 'Pliki',
  'sidebar.rail.search': 'Szukaj w projekcie',
  'sidebar.rail.git': 'Historia git',
  'sidebar.rail.knowledge': 'Wiedza (pliki MD)',
  'sidebar.rail.skills': 'Skille i agenci',
  'sidebar.rail.mcp': 'Serwery MCP',
  'sidebar.view.search': 'Szukaj',
  'sidebar.view.git': 'Historia git',
  'sidebar.view.knowledge': 'Wiedza',
  'sidebar.view.skills': 'Skille i agenci',
  'sidebar.view.mcp': 'Serwery MCP',

  // Doki
  'dock.right': 'Prawy dok',
  'dock.bottom': 'Dolny dok',
  'dock.split': 'Podziel przestrzeń: aktywna karta lub świeża sesja w panelu obok',
  'dock.newClaude': 'Nowa sesja Claude w tym panelu',
  'dock.newTerminal': 'Nowy terminal w tym panelu',
  'dock.statusDone': 'Claude skończył pracę',
  'dock.statusAttention': 'Claude czeka na zgodę',
  'dock.empty': 'Kliknij +, aby otworzyć terminal lub sesję Claude.',
  'dock.spawnFailed': 'Nie udało się uruchomić procesu: {error}',
  'dock.closeTitle': 'Zamknąć kartę?',
  'dock.closeMessage': 'Karta „{title}" ma działający proces — zostanie zakończony.',

  // Zakładki edytora i obszar edytora
  'tabs.split': 'Podziel przestrzeń roboczą — nowa grupa edytora obok',
  'tabs.preview': 'Podgląd przeglądarki (localhost) z trybem wskazywania elementów',
  'tabs.graphTitle': 'Graf wiedzy',
  'tabs.previewTitle': 'Podgląd',
  'editor.empty': 'Kliknij plik w panelu po lewej, aby go otworzyć.',
  'editor.externalChanged': 'Plik został zmieniony na dysku poza edytorem.',
  'editor.externalDeleted': 'Plik został usunięty z dysku.',
  'editor.reload': 'Przeładuj',
  'editor.keepMine': 'Zachowaj moją wersję',
  'editor.readTooLarge': 'Plik jest zbyt duży (limit 10 MB).',
  'editor.readBinary': 'Plik binarny — podgląd niedostępny.',
  'editor.readFailed': 'Nie udało się odczytać pliku.',
  'editor.unsavedTitle': 'Niezapisane zmiany',
  'editor.unsavedMessage': 'Plik „{name}" ma niezapisane zmiany. Zamknąć mimo to?',
  'editor.closeWithoutSave': 'Zamknij bez zapisu',
  'editor.saveFailed': 'Nie udało się zapisać pliku: {error}',


  // Ustawienia
  'settings.title': 'Ustawienia',
  'settings.appearance': 'Wygląd',
  'settings.themeAria': 'Motyw',
  'settings.accentAria': 'Kolor przewodni',
  'settings.language': 'Język / Language',
  'settings.project': 'Projekt',
  'settings.changeProject': 'Zmień folder projektu…',
  'settings.vault': 'Vault Obsidiana',
  'settings.vaultNone': '(nie skonfigurowano)',
  'settings.vaultChange': 'Zmień vault…',
  'settings.vaultPick': 'Wybierz vault…',
  'settings.vaultClear': 'Odepnij',
  'settings.config': 'Konfiguracja',
  'settings.configPath': 'Układ i stan aplikacji: ~/.config/sufler/ (layout.json, state.json)',

  // Motywy i akcenty
  'theme.system': 'Systemowy',
  'theme.light': 'Jasny',
  'theme.dark': 'Ciemny',
  'theme.matrix': 'Matrix',
  'accent.clay': 'Glinka',
  'accent.blue': 'Błękit',
  'accent.green': 'Zieleń',
  'accent.violet': 'Fiolet',
  'accent.pink': 'Róż',
  'themeToggle.toLight': 'Przełącz na motyw jasny',
  'themeToggle.toDark': 'Przełącz na motyw ciemny',
  'themeToggle.holdHint': ' · przytrzymaj, aby wybrać kolor przewodni',
  'themeToggle.accentTitle': 'Kolor przewodni',

  // Terminale
  'terminal.exited': '[proces zakończony]',
  'detached.noSession': 'Brak identyfikatora sesji.',
  'detached.gone': 'Sesja nie istnieje (mogła zostać zamknięta).',

  // Wspólne (ciąg dalszy)
  'common.loading': 'Wczytywanie…',
  'common.refresh': 'Odśwież',
  'common.linesAbbr': 'lin.',
  'common.noClaudeSession': 'Brak działającej sesji Claude — otwórz ją przyciskiem ✳ w doku.',

  // Jednostki (formy liczby mnogiej rozdzielone |: PL jeden|2-4|reszta, EN jeden|reszta)
  'unit.notes': 'notatka|notatki|notatek',
  'unit.edges': 'połączenie|połączenia|połączeń',
  'unit.lines': 'linia|linie|linii',
  'unit.matches': 'trafienie|trafienia|trafień',
  'unit.files': 'plik|pliki|plików',

  // Drzewo plików
  'ft.noAccess': 'Brak dostępu',
  'ft.empty': '(pusto)',
  'ft.openProject': 'Otwórz folder projektu…',
  'ft.refresh': 'Odśwież drzewo',
  'ft.showIgnored': 'Pokaż pliki ignorowane przez .gitignore',
  'ft.notes': 'Notatki',
  'ft.vaultDetach': 'Odepnij vault Obsidiana',
  'ft.vaultAddTitle': 'Vault Obsidiana jako drugi korzeń drzewa',
  'ft.vaultAdd': '+ Dodaj vault Obsidiana…',

  // Panel git
  'git.statusAdded': 'dodany',
  'git.statusModified': 'zmieniony',
  'git.statusDeleted': 'usunięty',
  'git.statusRenamed': 'przeniesiony',
  'git.statusCopied': 'skopiowany',
  'git.statusTypeChange': 'zmiana typu',
  'git.justNow': 'przed chwilą',
  'git.minutesAgo': '{minutes} min temu',
  'git.hoursAgo': '{hours} godz. temu',
  'git.daysAgo': '{days} dn. temu',
  'git.branch': 'Gałąź: {branch}',
  'git.header': 'Historia commitów',
  'git.refresh': 'Odśwież historię',
  'git.loading': 'Czytam historię…',
  'git.notRepo': 'To nie jest repozytorium git — zainicjuj je przez `git init` w terminalu.',
  'git.noCommits': 'Brak commitów w repozytorium.',
  'git.noSubject': '(bez opisu)',
  'git.loadingFiles': 'Wczytywanie zmian…',
  'git.noFiles': 'Brak zmian plików.',
  'git.changesTitle': 'Zmiany robocze',
  'git.statusUntracked': 'nieśledzony',

  // Diffy (M33) — panel Git i propozycje openDiff z sesji Claude
  'diff.worktreeSuffix': 'zmiany',
  'diff.ideDefault': 'Propozycja Claude',
  'diff.accept': 'Zastosuj',
  'diff.reject': 'Odrzuć',
  'diff.loading': 'Wczytywanie różnic…',
  'diff.unavailable': 'Nie udało się wczytać różnic.',
  'diff.binary': 'Plik binarny — bez podglądu różnic.',
  'diff.expired': 'Ta propozycja wygasła — poproś Claude o ponowienie zmiany.',

  // Graf wiedzy
  'graph.uncommitted': '(niezacommitowane)',
  'graph.modeAuthor': 'Autor',
  'graph.modeCategory': 'Funkcja',
  'graph.modeLayer': 'Warstwa',
  'graph.titleAuthor': 'Ostatnia zmiana',
  'graph.titleCategory': 'Funkcja programu',
  'graph.titleLayer': 'Warstwa',
  'graph.building': 'Buduję graf…',
  'graph.relayout': 'Przelicz',
  'graph.modeAria': 'Kolorowanie grafu',
  'graph.filterOff': 'Wyłącz filtr',
  'graph.filterOnly': 'Pokaż tylko tę grupę',
  'graph.closeDetails': 'Zamknij szczegóły',
  'graph.tags': 'Funkcja: {category} · Warstwa: {layer}',
  'graph.openNote': 'Otwórz notatkę',
  'graph.related': 'Powiązane ({count})',
  'graph.noRelated': 'Brak powiązań z innymi notatkami',
  'graph.hint': 'Klik = powiązania · podwójny klik = otwórz · przeciągnij węzeł/tło · kółko = zoom',

  // Panel wiedzy
  'knowledge.hint':
    'Wszystkie notatki markdown projektu w jednym miejscu. Konspekt wiedzy (`konspekt-wiedzy.md`) aktualizuje się sam przy każdej zmianie notatek, a Claude pobiera go narzędziem MCP `konspekt` — zawsze wie, co gdzie jest.',
  'knowledge.graphOpen': 'Graf wiedzy: notatki, linki i autorzy (à la Obsidian)',
  'knowledge.refresh': 'Odśwież listę',
  'knowledge.scanning': 'Skanuję pliki .md…',
  'knowledge.noFiles':
    'Brak plików markdown w projekcie. Notatki, README i dokumentacja `.md` pojawią się tutaj automatycznie.',
  'knowledge.openFile': 'Otwórz {path}',
  'knowledge.mcpLabel': 'MCP grafu wiedzy',
  'knowledge.mcpRunning': 'działa',
  'knowledge.mcpStarting': 'uruchamianie…',
  'knowledge.mcpRegister': 'Podłącz do Claude',
  'knowledge.mcpNote':
    'Po podłączeniu sesje Claude mają narzędzia: graf_wiedzy · notatka · powiazania — agent sam sprawdza, co jest z czym powiązane.',

  // Panel MCP
  'mcp.stateConnected': 'połączony',
  'mcp.stateError': 'błąd połączenia',
  'mcp.statePending': 'oczekuje na zatwierdzenie',
  'mcp.stateUnknown': 'stan nieznany — odśwież',
  'mcp.checking': 'Sprawdzanie połączeń…',
  'mcp.source': 'Konfiguracja + `claude mcp list`',
  'mcp.refresh': 'Odśwież (konfiguracja i stan połączeń)',
  'mcp.cliError': 'CLI: {error}',
  'mcp.empty': 'Brak zdefiniowanych serwerów MCP. Dodaj przez `claude mcp add …` albo plik `.mcp.json`.',
  'mcp.obsidianHint':
    'Serwer MCP Obsidiana działa tylko przy otwartym Obsidianie — uruchom Obsidiana i odśwież.',
  'mcp.loadingDetails': 'Wczytywanie szczegółów…',
  'mcp.noDetails': 'Brak szczegółów z CLI.',

  // Panel skilli
  'skills.emptyGroup': '(brak)',
  'skills.project': 'Skille projektu',
  'skills.personal': 'Skille osobiste',
  'skills.agents': 'Subagenci',
  'skills.rules': 'Reguły',
  'skills.claudeMd': 'Pliki CLAUDE.md',
  'skills.claudeMdHint': 'Długi CLAUDE.md to rozdmuchany kontekst — Claude gubi wtedy instrukcje.',
  'skills.new': '+ Nowy skill',
  'skills.offBadge': 'wyłączony',
  'skills.toggleTitle':
    'Włącz/wyłącz skill — zapis skillOverrides w .claude/settings.local.json (tylko ten projekt)',
  'skills.toggleUnreadable':
    'Nie udało się przełączyć: .claude/settings.local.json zawiera błędny JSON.',
  'skills.toggleFailed': 'Nie udało się zapisać .claude/settings.local.json.',
  'skills.agentToggleTitle':
    'Włącz/wyłącz subagenta — reguła Agent(nazwa) w permissions.deny w .claude/settings.local.json (tylko ten projekt)',
  'skills.agentLocked':
    'Wyłączony regułą deny w settings.json projektu lub użytkownika — usuń ją tam; lokalny przełącznik jej nie nadpisze.',
  'skills.create.title': 'Nowy skill',
  'skills.create.hint':
    'Skill to katalog z plikiem SKILL.md — opis podpowiada Claude, kiedy ma po niego sięgnąć.',
  'skills.create.scope': 'Zakres',
  'skills.create.scopeProject': 'Projekt — .claude/skills',
  'skills.create.scopePersonal': 'Osobisty — ~/.claude/skills',
  'skills.create.name': 'Nazwa',
  'skills.create.namePh': 'np. generator-changelog',
  'skills.create.description': 'Opis (kiedy używać)',
  'skills.create.descPh': 'Użyj, gdy…',
  'skills.create.manual': 'Tylko wywołanie ręczne przez /nazwa (disable-model-invocation)',
  'skills.create.disallowed': 'Zablokowane narzędzia (disallowed-tools, opcjonalne)',
  'skills.create.disallowedPh': 'np. Bash, WebFetch',
  'skills.create.body': 'Instrukcje',
  'skills.create.template': '## Kiedy używać\n\n- …\n\n## Kroki\n\n1. …\n2. …\n',
  'skills.create.submit': 'Utwórz skill',
  'skills.create.nameEmpty': 'Podaj nazwę skilla.',
  'skills.create.nameInvalid':
    'Nazwa: małe litery, cyfry i pojedyncze myślniki (kebab-case), np. moj-skill.',
  'skills.create.nameTooLong': 'Nazwa może mieć najwyżej 64 znaki.',
  'skills.create.descRequired':
    'Opis jest wymagany — bez niego Claude nie wie, kiedy sięgnąć po skill.',
  'skills.create.exists': 'Skill o tej nazwie już istnieje w wybranym zakresie.',
  'skills.create.failed': 'Nie udało się zapisać SKILL.md.',
  'skills.create.created': 'Utworzono skill „{name}" — plik jest otwarty w edytorze.',

  // Wyszukiwanie
  'search.placeholder': 'Szukaj w projekcie (ripgrep)…',
  'search.searching': 'Szukam…',
  'search.noMatches': 'Brak trafień.',
  'search.inFiles': 'w {m} pl.',
  'search.truncated': ' (ucięte)',

  // Limity planu
  'usage.titleSession': 'Sesja 5h: {p}% limitu (reset {when})',
  'usage.titleWeek': ' · Tydzień: {p}% (reset {when})',
  'usage.titleError': 'Limity niedostępne: {error}',
  'usage.titleDefault': 'Limity planu Claude Code',
  'usage.pillWeek': 'tydz. {p}%',
  'usage.pillError': 'limity —',
  'usage.pillLoading': 'limity…',
  'usage.header': 'Limity planu Claude',
  'usage.fetching': 'Pobieram…',
  'usage.loading': 'Pobieram limity…',
  'usage.session': 'Sesja 5h',
  'usage.reset': 'reset {when}',
  'usage.week': 'Tydzień (wszystkie modele)',
  'usage.error': 'Limity planu: {error}',

  // Podgląd przeglądarki
  'preview.copied': 'Brak sesji Claude — odniesienie skopiowano do schowka.',
  'preview.go': 'Otwórz',
  'preview.reload': 'Przeładuj stronę',
  'preview.pickTitle':
    'Kliknij element na stronie, aby wstawić odniesienie do sesji Claude (Esc anuluje)',
  'preview.picking': 'Wskazywanie…',
  'preview.pick': 'Wskaż element',
  'preview.empty':
    'Wpisz adres (np. localhost:3000) i naciśnij Enter, aby otworzyć podgląd aplikacji webowej. Potem „Wskaż element", by wysłać odniesienie do sesji Claude.',

  // Logowanie
  'login.aria': 'Logowanie do Claude',
  'login.title': 'Zaloguj się do Claude',
  'login.sub': 'Konto z subskrypcją (Pro/Max/Team) albo Console — flow `claude /login`.',
  'login.closeTitle': 'Zamknij (przerywa logowanie, jeśli trwa)',
  'login.startFailed': 'Nie udało się uruchomić `claude`: {error}',
  'login.starting': 'Uruchamianie logowania…',
  'login.footer':
    'Metodę wybierasz strzałkami i Enterem · Esc w terminalu anuluje · po „Login successful" zamknij okno',

  // Przełączniki układu
  'layout.sidebar': 'Pasek boczny (Cmd+B)',
  'layout.bottom': 'Dolny dok (Ctrl+`)',
  'layout.right': 'Prawy dok (Cmd+Shift+C)',
  'layout.hide': 'Zwiń',
  'layout.show': 'Rozwiń',

  // Podgląd obrazków
  'image.tooLarge': 'Plik jest zbyt duży do podglądu (limit 25 MB).',
  'image.notImage': 'To nie jest obsługiwany plik graficzny.',
  'image.loading': 'Wczytuję obrazek…',

  // Ekran startowy
  'welcome.tagline': 'Środowisko pracy z Claude Code',
  'welcome.sub':
    'Wybierz folder, w którym chcesz pracować — terminale i sesje Claude wystartują właśnie w nim.',
  'welcome.open': 'Otwórz folder…',
  'welcome.recents': 'Ostatnie',

  // Menu aplikacji
  'menu.about': 'O aplikacji {app}',
  'menu.settings': 'Ustawienia…',
  'menu.services': 'Usługi',
  'menu.hide': 'Ukryj {app}',
  'menu.hideOthers': 'Ukryj pozostałe',
  'menu.unhide': 'Pokaż wszystkie',
  'menu.quit': 'Zakończ {app}',
  'menu.edit': 'Edycja',
  'menu.undo': 'Cofnij',
  'menu.redo': 'Przywróć',
  'menu.cut': 'Wytnij',
  'menu.copy': 'Skopiuj',
  'menu.paste': 'Wklej',
  'menu.selectAll': 'Zaznacz wszystko',
  'menu.view': 'Widok',
  'menu.toggleSidebar': 'Pokaż/ukryj pasek boczny',
  'menu.toggleBottom': 'Pokaż/ukryj dolny dok',
  'menu.toggleRight': 'Pokaż/ukryj prawy dok',
  'menu.reload': 'Przeładuj',
  'menu.devtools': 'Narzędzia deweloperskie',
  'menu.fullscreen': 'Pełny ekran',
  'menu.window': 'Okno',
  'menu.minimize': 'Zminimalizuj',
  'menu.zoom': 'Powiększ',
  'menu.front': 'Wszystkie na wierzch',

  // Proces główny (dialogi systemowe, błędy IPC)
  'main.openProject': 'Otwórz folder projektu',
  'main.chooseVault': 'Wybierz vault Obsidiana',
  'main.mcpRegistered': 'Zarejestrowano serwer „wiedza-graf" w Claude (scope user).',
  'main.mcpAlready': 'Serwer „wiedza-graf" był już zarejestrowany.',
  'main.mcpRegisterFailed': 'Nie udało się zarejestrować: {error}',
  'main.usageNoToken': 'Brak tokenu Claude Code w Keychain — zaloguj się (✳).',
  'main.usageExpired': 'Token wygasł — odśwież logowanie w Claude Code (✳).',
  'main.usageHttp': 'Endpoint limitów odpowiedział HTTP {status}.',
  'main.usageFetchFailed': 'Nie udało się pobrać limitów: {error}',
} as const;

export type StringKey = keyof typeof PL;

export const EN: Record<StringKey, string> = {
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
  'common.close': 'Close',
  'common.closeTab': 'Close tab',

  'titlebar.login': 'Sign in to your Claude account (opens `claude /login`)',

  'sidebar.aria': 'Sidebar views',
  'sidebar.rail.files': 'Files',
  'sidebar.rail.search': 'Search in project',
  'sidebar.rail.git': 'Git history',
  'sidebar.rail.knowledge': 'Knowledge (MD files)',
  'sidebar.rail.skills': 'Skills and agents',
  'sidebar.rail.mcp': 'MCP servers',
  'sidebar.view.search': 'Search',
  'sidebar.view.git': 'Git history',
  'sidebar.view.knowledge': 'Knowledge',
  'sidebar.view.skills': 'Skills and agents',
  'sidebar.view.mcp': 'MCP servers',

  'dock.right': 'Right dock',
  'dock.bottom': 'Bottom dock',
  'dock.split': 'Split the space: active tab or a fresh session in a pane alongside',
  'dock.newClaude': 'New Claude session in this pane',
  'dock.newTerminal': 'New terminal in this pane',
  'dock.statusDone': 'Claude finished working',
  'dock.statusAttention': 'Claude is waiting for approval',
  'dock.empty': 'Click + to open a terminal or a Claude session.',
  'dock.spawnFailed': 'Failed to start the process: {error}',
  'dock.closeTitle': 'Close this tab?',
  'dock.closeMessage': 'Tab “{title}” has a running process — it will be terminated.',

  'tabs.split': 'Split the workspace — a new editor group alongside',
  'tabs.preview': 'Browser preview (localhost) with element picking mode',
  'tabs.graphTitle': 'Knowledge graph',
  'tabs.previewTitle': 'Preview',
  'editor.empty': 'Click a file in the panel on the left to open it.',
  'editor.externalChanged': 'The file was changed on disk outside the editor.',
  'editor.externalDeleted': 'The file was deleted from disk.',
  'editor.reload': 'Reload',
  'editor.keepMine': 'Keep my version',
  'editor.readTooLarge': 'File is too large (10 MB limit).',
  'editor.readBinary': 'Binary file — preview unavailable.',
  'editor.readFailed': 'Failed to read the file.',
  'editor.unsavedTitle': 'Unsaved changes',
  'editor.unsavedMessage': 'File “{name}” has unsaved changes. Close anyway?',
  'editor.closeWithoutSave': 'Close without saving',
  'editor.saveFailed': 'Failed to save the file: {error}',


  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.themeAria': 'Theme',
  'settings.accentAria': 'Accent color',
  'settings.language': 'Language / Język',
  'settings.project': 'Project',
  'settings.changeProject': 'Change project folder…',
  'settings.vault': 'Obsidian vault',
  'settings.vaultNone': '(not configured)',
  'settings.vaultChange': 'Change vault…',
  'settings.vaultPick': 'Choose vault…',
  'settings.vaultClear': 'Unlink',
  'settings.config': 'Configuration',
  'settings.configPath': 'Layout and app state: ~/.config/sufler/ (layout.json, state.json)',

  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.matrix': 'Matrix',
  'accent.clay': 'Clay',
  'accent.blue': 'Blue',
  'accent.green': 'Green',
  'accent.violet': 'Violet',
  'accent.pink': 'Pink',
  'themeToggle.toLight': 'Switch to the light theme',
  'themeToggle.toDark': 'Switch to the dark theme',
  'themeToggle.holdHint': ' · hold to pick the accent color',
  'themeToggle.accentTitle': 'Accent color',

  'terminal.exited': '[process exited]',
  'detached.noSession': 'Missing session identifier.',
  'detached.gone': 'The session no longer exists (it may have been closed).',

  'common.loading': 'Loading…',
  'common.refresh': 'Refresh',
  'common.linesAbbr': 'ln.',
  'common.noClaudeSession': 'No running Claude session — open one with the ✳ button in a dock.',

  'unit.notes': 'note|notes',
  'unit.edges': 'connection|connections',
  'unit.lines': 'line|lines',
  'unit.matches': 'match|matches',
  'unit.files': 'file|files',

  'ft.noAccess': 'No access',
  'ft.empty': '(empty)',
  'ft.openProject': 'Open project folder…',
  'ft.refresh': 'Refresh tree',
  'ft.showIgnored': 'Show files ignored by .gitignore',
  'ft.notes': 'Notes',
  'ft.vaultDetach': 'Unlink the Obsidian vault',
  'ft.vaultAddTitle': 'Obsidian vault as a second tree root',
  'ft.vaultAdd': '+ Add an Obsidian vault…',

  'git.statusAdded': 'added',
  'git.statusModified': 'modified',
  'git.statusDeleted': 'deleted',
  'git.statusRenamed': 'renamed',
  'git.statusCopied': 'copied',
  'git.statusTypeChange': 'type change',
  'git.justNow': 'just now',
  'git.minutesAgo': '{minutes} min ago',
  'git.hoursAgo': '{hours} h ago',
  'git.daysAgo': '{days} d ago',
  'git.branch': 'Branch: {branch}',
  'git.header': 'Commit history',
  'git.refresh': 'Refresh history',
  'git.loading': 'Reading history…',
  'git.notRepo': 'This is not a git repository — initialize it with `git init` in the terminal.',
  'git.noCommits': 'No commits in the repository.',
  'git.noSubject': '(no subject)',
  'git.loadingFiles': 'Loading changes…',
  'git.noFiles': 'No file changes.',
  'git.changesTitle': 'Working changes',
  'git.statusUntracked': 'untracked',

  'diff.worktreeSuffix': 'changes',
  'diff.ideDefault': 'Claude proposal',
  'diff.accept': 'Apply',
  'diff.reject': 'Reject',
  'diff.loading': 'Loading diff…',
  'diff.unavailable': 'Could not load the diff.',
  'diff.binary': 'Binary file — no diff preview.',
  'diff.expired': 'This proposal has expired — ask Claude to retry the change.',

  'graph.uncommitted': '(uncommitted)',
  'graph.modeAuthor': 'Author',
  'graph.modeCategory': 'Function',
  'graph.modeLayer': 'Layer',
  'graph.titleAuthor': 'Last change',
  'graph.titleCategory': 'Program function',
  'graph.titleLayer': 'Layer',
  'graph.building': 'Building the graph…',
  'graph.relayout': 'Re-layout',
  'graph.modeAria': 'Graph coloring',
  'graph.filterOff': 'Clear the filter',
  'graph.filterOnly': 'Show only this group',
  'graph.closeDetails': 'Close details',
  'graph.tags': 'Function: {category} · Layer: {layer}',
  'graph.openNote': 'Open note',
  'graph.related': 'Related ({count})',
  'graph.noRelated': 'No links to other notes',
  'graph.hint': 'Click = links · double-click = open · drag a node/background · wheel = zoom',

  'knowledge.hint':
    'All the project’s markdown notes in one place. The knowledge outline (`konspekt-wiedzy.md`) updates itself on every note change, and Claude fetches it with the MCP `konspekt` tool — it always knows what lives where.',
  'knowledge.graphOpen': 'Knowledge graph: notes, links and authors (à la Obsidian)',
  'knowledge.refresh': 'Refresh list',
  'knowledge.scanning': 'Scanning .md files…',
  'knowledge.noFiles':
    'No markdown files in the project. Notes, README and `.md` docs will show up here automatically.',
  'knowledge.openFile': 'Open {path}',
  'knowledge.mcpLabel': 'Knowledge graph MCP',
  'knowledge.mcpRunning': 'running',
  'knowledge.mcpStarting': 'starting…',
  'knowledge.mcpRegister': 'Connect to Claude',
  'knowledge.mcpNote':
    'Once connected, Claude sessions get the tools: graf_wiedzy · notatka · powiazania — the agent checks on its own what links to what.',

  'mcp.stateConnected': 'connected',
  'mcp.stateError': 'connection error',
  'mcp.statePending': 'pending approval',
  'mcp.stateUnknown': 'state unknown — refresh',
  'mcp.checking': 'Checking connections…',
  'mcp.source': 'Configuration + `claude mcp list`',
  'mcp.refresh': 'Refresh (configuration and connection state)',
  'mcp.cliError': 'CLI: {error}',
  'mcp.empty': 'No MCP servers defined. Add one with `claude mcp add …` or a `.mcp.json` file.',
  'mcp.obsidianHint':
    'The Obsidian MCP server only works while Obsidian is open — launch Obsidian and refresh.',
  'mcp.loadingDetails': 'Loading details…',
  'mcp.noDetails': 'No details from the CLI.',

  'skills.emptyGroup': '(none)',
  'skills.project': 'Project skills',
  'skills.personal': 'Personal skills',
  'skills.agents': 'Subagents',
  'skills.rules': 'Rules',
  'skills.claudeMd': 'CLAUDE.md files',
  'skills.claudeMdHint': 'A long CLAUDE.md means bloated context — Claude starts losing instructions.',
  'skills.new': '+ New skill',
  'skills.offBadge': 'off',
  'skills.toggleTitle':
    'Enable/disable the skill — saves skillOverrides in .claude/settings.local.json (this project only)',
  'skills.toggleUnreadable': 'Toggle failed: .claude/settings.local.json contains invalid JSON.',
  'skills.toggleFailed': 'Failed to write .claude/settings.local.json.',
  'skills.agentToggleTitle':
    'Enable/disable the subagent — an Agent(name) rule in permissions.deny of .claude/settings.local.json (this project only)',
  'skills.agentLocked':
    'Disabled by a deny rule in project or user settings.json — remove it there; the local toggle cannot override it.',
  'skills.create.title': 'New skill',
  'skills.create.hint':
    'A skill is a folder with a SKILL.md file — the description tells Claude when to reach for it.',
  'skills.create.scope': 'Scope',
  'skills.create.scopeProject': 'Project — .claude/skills',
  'skills.create.scopePersonal': 'Personal — ~/.claude/skills',
  'skills.create.name': 'Name',
  'skills.create.namePh': 'e.g. changelog-generator',
  'skills.create.description': 'Description (when to use)',
  'skills.create.descPh': 'Use when…',
  'skills.create.manual': 'Manual invocation only via /name (disable-model-invocation)',
  'skills.create.disallowed': 'Blocked tools (disallowed-tools, optional)',
  'skills.create.disallowedPh': 'e.g. Bash, WebFetch',
  'skills.create.body': 'Instructions',
  'skills.create.template': '## When to use\n\n- …\n\n## Steps\n\n1. …\n2. …\n',
  'skills.create.submit': 'Create skill',
  'skills.create.nameEmpty': 'Enter a skill name.',
  'skills.create.nameInvalid':
    'Name: lowercase letters, digits and single hyphens (kebab-case), e.g. my-skill.',
  'skills.create.nameTooLong': 'The name can be at most 64 characters.',
  'skills.create.descRequired':
    'The description is required — without it Claude does not know when to reach for the skill.',
  'skills.create.exists': 'A skill with this name already exists in the chosen scope.',
  'skills.create.failed': 'Failed to write SKILL.md.',
  'skills.create.created': 'Created skill “{name}” — the file is open in the editor.',

  'search.placeholder': 'Search in project (ripgrep)…',
  'search.searching': 'Searching…',
  'search.noMatches': 'No matches.',
  'search.inFiles': 'in {m} files',
  'search.truncated': ' (truncated)',

  'usage.titleSession': '5h session: {p}% of the limit (resets {when})',
  'usage.titleWeek': ' · Week: {p}% (resets {when})',
  'usage.titleError': 'Limits unavailable: {error}',
  'usage.titleDefault': 'Claude Code plan limits',
  'usage.pillWeek': 'wk {p}%',
  'usage.pillError': 'limits —',
  'usage.pillLoading': 'limits…',
  'usage.header': 'Claude plan limits',
  'usage.fetching': 'Fetching…',
  'usage.loading': 'Fetching limits…',
  'usage.session': '5h session',
  'usage.reset': 'resets {when}',
  'usage.week': 'Week (all models)',
  'usage.error': 'Plan limits: {error}',

  'preview.copied': 'No Claude session — the reference was copied to the clipboard.',
  'preview.go': 'Open',
  'preview.reload': 'Reload page',
  'preview.pickTitle':
    'Click an element on the page to insert a reference into the Claude session (Esc cancels)',
  'preview.picking': 'Picking…',
  'preview.pick': 'Pick element',
  'preview.empty':
    'Enter an address (e.g. localhost:3000) and press Enter to open a preview of your web app. Then use "Pick element" to send a reference to the Claude session.',

  'login.aria': 'Claude sign-in',
  'login.title': 'Sign in to Claude',
  'login.sub': 'An account with a subscription (Pro/Max/Team) or Console — the `claude /login` flow.',
  'login.closeTitle': 'Close (aborts sign-in if in progress)',
  'login.startFailed': 'Failed to launch `claude`: {error}',
  'login.starting': 'Starting sign-in…',
  'login.footer':
    'Pick a method with the arrow keys and Enter · Esc in the terminal cancels · after "Login successful" close this window',

  'layout.sidebar': 'Sidebar (Cmd+B)',
  'layout.bottom': 'Bottom dock (Ctrl+`)',
  'layout.right': 'Right dock (Cmd+Shift+C)',
  'layout.hide': 'Hide',
  'layout.show': 'Show',

  'image.tooLarge': 'File is too large to preview (25 MB limit).',
  'image.notImage': 'This is not a supported image file.',
  'image.loading': 'Loading image…',

  'welcome.tagline': 'A working environment for Claude Code',
  'welcome.sub':
    'Pick the folder you want to work in — terminals and Claude sessions will start right there.',
  'welcome.open': 'Open folder…',
  'welcome.recents': 'Recent',

  'menu.about': 'About {app}',
  'menu.settings': 'Settings…',
  'menu.services': 'Services',
  'menu.hide': 'Hide {app}',
  'menu.hideOthers': 'Hide Others',
  'menu.unhide': 'Show All',
  'menu.quit': 'Quit {app}',
  'menu.edit': 'Edit',
  'menu.undo': 'Undo',
  'menu.redo': 'Redo',
  'menu.cut': 'Cut',
  'menu.copy': 'Copy',
  'menu.paste': 'Paste',
  'menu.selectAll': 'Select All',
  'menu.view': 'View',
  'menu.toggleSidebar': 'Show/hide sidebar',
  'menu.toggleBottom': 'Show/hide bottom dock',
  'menu.toggleRight': 'Show/hide right dock',
  'menu.reload': 'Reload',
  'menu.devtools': 'Developer Tools',
  'menu.fullscreen': 'Full Screen',
  'menu.window': 'Window',
  'menu.minimize': 'Minimize',
  'menu.zoom': 'Zoom',
  'menu.front': 'Bring All to Front',

  'main.openProject': 'Open project folder',
  'main.chooseVault': 'Choose an Obsidian vault',
  'main.mcpRegistered': 'Registered the "wiedza-graf" server in Claude (user scope).',
  'main.mcpAlready': 'The "wiedza-graf" server was already registered.',
  'main.mcpRegisterFailed': 'Registration failed: {error}',
  'main.usageNoToken': 'No Claude Code token in the Keychain — sign in (✳).',
  'main.usageExpired': 'Token expired — refresh your Claude Code sign-in (✳).',
  'main.usageHttp': 'The limits endpoint responded with HTTP {status}.',
  'main.usageFetchFailed': 'Failed to fetch limits: {error}',
};

export function stringsFor(lang: Language): Record<StringKey, string> {
  return lang === 'en' ? EN : PL;
}

/**
 * Forma liczby mnogiej z form rozdzielonych `|`.
 * PL: jeden|2-4 (poza 12-14)|reszta; EN: jeden|reszta.
 */
export function pluralForm(lang: Language, n: number, forms: string): string {
  const parts = forms.split('|');
  if (lang === 'en') {
    return (n === 1 ? parts[0] : parts[1] ?? parts[0]) ?? '';
  }
  if (n === 1) {
    return parts[0] ?? '';
  }
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return parts[1] ?? parts[0] ?? '';
  }
  return parts[2] ?? parts[1] ?? parts[0] ?? '';
}

/** Locale do formatowania dat/liczb zgodnie z językiem UI. */
export function localeFor(lang: Language): string {
  return lang === 'en' ? 'en-US' : 'pl-PL';
}

/** Podstawia {nazwa} w tekście; nieznane placeholdery zostawia bez zmian. */
export function fillPlaceholders(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
