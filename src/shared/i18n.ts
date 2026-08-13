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
  'titlebar.settings': 'Ustawienia (Cmd+,)',

  // Sidebar
  'sidebar.aria': 'Widoki panelu bocznego',
  'sidebar.rail.files': 'Pliki',
  'sidebar.rail.search': 'Szukaj w projekcie',
  'sidebar.rail.git': 'Historia git',
  'sidebar.rail.knowledge': 'Wiedza (pliki MD)',
  'sidebar.rail.skills': 'Skille i agenci',
  'sidebar.rail.mcp': 'Serwery MCP',
  'sidebar.rail.sessions': 'Historia sesji Claude',
  'sidebar.view.search': 'Szukaj',
  'sidebar.view.git': 'Historia git',
  'sidebar.view.knowledge': 'Wiedza',
  'sidebar.view.skills': 'Skille i agenci',
  'sidebar.view.mcp': 'Serwery MCP',
  'sidebar.view.sessions': 'Sesje',

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
  'dock.resume': 'Wznów zapisaną sesję Claude tego projektu',
  'dock.resumeLoading': 'Szukam sesji…',
  'dock.resumeEmpty': 'Brak zapisanych sesji dla tego projektu.',
  'dock.resumeTabTitle': 'Claude ↺',
  'dock.notifDone': 'Claude skończył pracę',
  'dock.notifAttention': 'Claude czeka na zgodę',
  'dock.notifBody': 'Karta „{title}" — wróć do Suflera.',
  'dock.copyPrompt': 'Kopiuj polecenie: zaznaczenie, a bez niego ostatni prompt tej sesji',
  'dock.copyPromptOk': 'Polecenie skopiowane do schowka.',
  'dock.copyPromptEmpty': 'Nie ma czego kopiować — zaznacz tekst albo wyślij polecenie.',
  'dock.copyPromptFailed': 'Nie udało się skopiować do schowka.',

  // Zakładki edytora i obszar edytora
  'tabs.split': 'Podziel przestrzeń roboczą — nowa grupa edytora obok',
  'tabs.preview': 'Podgląd przeglądarki (localhost) z trybem wskazywania elementów',
  'tabs.graphTitle': 'Graf wiedzy',
  'tabs.settingsTitle': 'Ustawienia',
  'tabs.helpTitle': 'Samouczek',
  'tabs.worklogTitle': 'Historia pracy',
  'worklog.title': 'Historia pracy',
  'worklog.subtitle':
    'Commity i dzienniki sesji na jednej osi czasu — widać, która rozmowa doprowadziła do której zmiany.',
  'worklog.empty': 'Brak wpisów — pojawią się po pierwszym commicie albo sesji Claude.',
  'worklog.commit': 'commit',
  'worklog.session': 'sesja',
  'worklog.operations': '{n} operacji',
  'worklog.open': 'Historia pracy — commity i sesje na osi czasu',
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
  'settings.subtitle': 'Wygląd, język i integracje — zmiany zapisują się od razu.',
  'settings.appearance': 'Wygląd',
  'settings.appearanceHint': 'Motyw i kolor przewodni obowiązują w całej aplikacji, także w terminalach.',
  'settings.themeAria': 'Motyw',
  'settings.accentAria': 'Kolor przewodni',
  'settings.language': 'Język / Language',
  'settings.project': 'Projekt',
  'settings.changeProject': 'Zmień folder projektu…',
  'settings.config': 'Konfiguracja',
  'settings.configPath': 'Układ i stan aplikacji: ~/.config/sufler/ (layout.json, state.json)',
  'knowledge.summarize': 'Streść',
  'knowledge.summarizing': 'Streszczam…',
  'knowledge.summarizeHint':
    'Poproś Claude o podsumowanie dziennika (co zrobiono, co dalej) — wynik ląduje na górze pliku. Wywołanie zużywa limit planu.',
  'knowledge.summarizeOk': 'Podsumowanie dopisane na górze dziennika.',
  'knowledge.summarizeShort': 'Dziennik jest za krótki na streszczenie.',
  'knowledge.summarizeFailed': 'Nie udało się uruchomić `claude -p` — sprawdź logowanie i limity.',
  'knowledge.summarizeError': 'Nie udało się zapisać podsumowania.',
  'settings.sessionLog': 'Dziennik sesji Claude',
  'settings.sessionLogHint':
    'Sufler dopisuje przebieg pracy (polecenia, edytowane pliki, komendy) do pliku .md w katalogu dziennik-sesji/. Po `/clear` wczytaj ten plik, aby wrócić do wątku bez odtwarzania całej rozmowy — to najprostszy sposób na oszczędzanie kontekstu.',
  'settings.sessionLogSwitch': 'Zapisuj dziennik sesji',
  'settings.sessionLogGlobal': 'Także dla sesji poza Suflerem',
  'settings.sessionLogGlobalHint':
    'Instaluje skrypt w ~/.claude i wpina go w globalne hooki Claude Code, więc dziennik powstaje również dla sesji uruchamianych w zwykłym terminalu. Twoje pozostałe hooki zostają nietknięte.',
  'settings.obsidianTitle': 'Obsidian — notatka dzienna',
  'settings.obsidianIntro':
    'Opcjonalne. Wymaga pluginu Local REST API uruchomionego w Obsidianie.',
  'settings.obsidianApiKey': 'Klucz API (plugin Local REST API)',
  'settings.obsidianUrl': 'Adres serwera',
  'settings.obsidianDailyFile': 'Plik notatki — {date} to dzisiejsza data',
  'settings.obsidianDailyHeading': 'Nagłówek docelowy',
  'settings.obsidianHint':
    'Zaznacz tekst w edytorze i użyj Cmd+Shift+L (albo menu kontekstowego), aby dopisać go pod wskazany nagłówek.',

  // Warstwa 3 Obsidiana (M36)
  'obsidian.sendAction': 'Wyślij zaznaczenie do notatki dziennej',
  'obsidian.sendOk': 'Dopisano do notatki dziennej.',
  'obsidian.sendEmpty': 'Zaznacz najpierw tekst do wysłania.',
  'obsidian.sendNotConfigured':
    'Uzupełnij konfigurację Obsidiana w Ustawieniach (klucz API, plik, nagłówek).',
  'obsidian.sendUnreachable':
    'Brak połączenia z Obsidianem — uruchom Obsidiana z włączonym pluginem Local REST API.',
  'obsidian.sendRejected': 'Obsidian odrzucił zapis — sprawdź klucz API i nagłówek.',

  // Szybkie otwieranie Cmd+P (M37)
  'quickOpen.placeholder': 'Szukaj pliku po nazwie…',
  'quickOpen.empty': 'Brak pasujących plików.',

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
  'unit.items': 'element|elementy|elementów',
  'unit.sessions': 'sesja|sesje|sesji',
  'unit.prompts': 'polecenie|polecenia|poleceń',
  'unit.replies': 'odpowiedź|odpowiedzi|odpowiedzi',
  'unit.tools': 'narzędzie|narzędzia|narzędzi',

  // Drzewo plików
  'ft.noAccess': 'Brak dostępu',
  'ft.empty': '(pusto)',
  'ft.openProject': 'Otwórz folder projektu…',
  'ft.refresh': 'Odśwież drzewo',
  'ft.showIgnored': 'Pokaż pliki ignorowane przez .gitignore',
  'ft.importDone': 'Dodano do projektu: {count}',
  'ft.importSkipped': 'Pominięto: {names}',
  'ft.importFailed': 'Import upuszczonych plików nie powiódł się',

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

  // Commit z aplikacji (M69) — zaznaczenie plików, opis, zatwierdzenie
  'git.selectAll': 'Wszystkie',
  'git.selectFile': 'Zaznacz do commita: {path}',
  'git.commitPlaceholder': 'Opis zmiany…',
  'git.commit': 'Zatwierdź ({count})',
  'git.commitHint': 'Zaznacz pliki i napisz opis, żeby zatwierdzić.',
  'git.commitWorking': 'Zatwierdzam…',
  'git.commitDone': 'Zatwierdzono {hash}: {subject}',
  'git.commitFailed': 'Nie udało się zatwierdzić zmian.',
  'git.commitIdentity': 'Git nie zna autora — ustaw `user.name` i `user.email` w terminalu.',
  'git.commitNothing': 'Nie ma czego zatwierdzać — zaznaczone pliki zniknęły z listy.',

  // Panel „Sesje" (M67) — historia rozmów z Claude w tym projekcie
  'sessions.refresh': 'Odśwież listę sesji',
  'sessions.loading': 'Czytam zapisane sesje…',
  'sessions.empty':
    'Brak zapisanych sesji dla tego projektu — pojawią się po pierwszej rozmowie z Claude.',
  'sessions.resume': 'Wznów tę rozmowę w nowej karcie (claude --resume)',
  'sessions.detailsLoading': 'Czytam transkrypt…',
  'sessions.detailsFailed': 'Nie udało się odczytać transkryptu sesji.',
  'sessions.started': 'Początek: {when}',
  'sessions.lastActivity': 'Ostatnia aktywność: {when}',
  'sessions.previewTitle': 'Ostatnie wymiany',
  'sessions.previewTruncated': 'Wcześniejsze wiadomości pominięte.',
  'sessions.previewEmpty': 'Ta sesja nie ma wiadomości do pokazania.',
  'sessions.you': 'Ty',
  'sessions.claude': 'Claude',
  'sessions.branch': 'Gałąź w czasie rozmowy: {branch}',
  'checkpoints.title': 'Punkty przywracania',
  'checkpoints.hint':
    'Migawka drzewa zapisywana przed każdą turą Claude. Przywrócenie zapisuje najpierw stan bieżący, więc cofnięcie też da się cofnąć.',
  'checkpoints.empty': 'Brak migawek — pojawią się przy pierwszym poleceniu dla Claude.',
  'checkpoints.restore': 'Przywróć',
  'checkpoints.restoreTitle': 'Przywrócić pliki z tej migawki?',
  'checkpoints.restoreMessage':
    'Pliki w projekcie wrócą do stanu „{label}". Bieżący stan zapiszę jako nową migawkę.',
  'checkpoints.restored': 'Przywrócono stan z migawki.',
  'checkpoints.restoreFailed': 'Nie udało się przywrócić migawki.',
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
  'graph.modeTags': 'Tagi',
  'graph.modeFresh': 'Świeżość',
  'graph.titleTags': 'Tagi notatek',
  'graph.titleFresh': 'Ostatnia aktywność',
  'graph.noTags': '(bez tagów)',
  'graph.freshToday': 'Dziś',
  'graph.freshWeek': 'Ostatni tydzień',
  'graph.freshMonth': 'Ostatni miesiąc',
  'graph.freshOlder': 'Starsze',
  'graph.searchPh': 'Szukaj w grafie…',
  'graph.hideOrphans': 'Ukryj osierocone',
  'graph.orphansTitle': 'Schowaj notatki bez żadnych połączeń',

  // Samouczek (M42)
  'help.open': 'Samouczek — jak korzystać z aplikacji',
  'help.title': 'Samouczek Suflera',
  'help.intro':
    'Krótki przewodnik po oknie: pasek ikon po lewej przełącza panele projektu, środek to edytor, a doki (prawy i dolny) mieszczą sesje Claude i terminale.',
  'help.start.title': 'Na start',
  'help.start.body':
    'Otwórz folder projektu (ekran startowy albo Ustawienia → Zmień folder). Sufler pracuje na tym samym katalogu co Claude Code — panele tylko czytają dysk i konfigurację, więc niczego nie zepsują.',
  'help.files.title': 'Pliki',
  'help.files.body':
    'Drzewo projektu koloruje statusy git i domyślnie ukrywa pliki z .gitignore (oko w nagłówku to zmienia). Klik otwiera plik w edytorze, podwójny klik przypina zakładkę, a menu kontekstowe wstawia @ścieżkę prosto do aktywnej sesji Claude.',
  'help.search.title': 'Szukaj i Cmd+P',
  'help.search.body':
    'Panel Szukaj przeszukuje treść plików (ripgrep) i otwiera trafienia w edytorze. Cmd+P to szybkie otwieranie pliku po nazwie, bez odrywania rąk od klawiatury.',
  'help.git.title': 'Historia git',
  'help.git.body':
    'Lista commitów z gałęzią i sekcją zmian roboczych. Klik w plik pokazuje diff w Monaco, a propozycje zmian od Claude (openDiff) mają przyciski Zastosuj/Odrzuć.',
  'help.kontekst.title': 'Dziennik sesji — oszczędzanie kontekstu',
  'help.kontekst.body':
    'Każda sesja Claude prowadzona w Suflerze dopisuje przebieg pracy do pliku w katalogu dziennik-sesji/: Twoje polecenia, edytowane pliki i komendy powłoki. Dzięki temu możesz spokojnie użyć /clear — wracasz do wątku, wczytując jeden krótki plik zamiast odtwarzać rozmowę. Przycisk „Streść" w panelu Wiedza prosi Claude o podsumowanie (co zrobiono, co dalej) na górze dziennika. W Ustawieniach włączysz zapis także dla sesji uruchamianych poza aplikacją.',
  'help.ratunek.title': 'Punkty przywracania',
  'help.ratunek.body':
    'Przed każdą turą Claude aplikacja zapisuje migawkę drzewa projektu w osobnym refie gita — bez dotykania Twoich commitów, gałęzi i indeksu. Listę znajdziesz w panelu Historia git; jedno kliknięcie cofa pliki do wybranego stanu, a bieżący stan trafia najpierw do nowej migawki, więc cofnięcie też da się cofnąć.',
  'help.historia.title': 'Historia pracy',
  'help.historia.body':
    'Ikona ◷ w panelu Historia git otwiera oś czasu, na której commity spotykają się z dziennikami sesji, pogrupowane po dniach. Widać, która rozmowa doprowadziła do której zmiany; klik w sesję otwiera jej dziennik.',
  'help.limity.title': 'Limity planu',
  'help.limity.body':
    'Pigułka na pasku tytułu pokazuje zużycie okna 5-godzinnego i tygodnia. Po kliknięciu zobaczysz też prognozę — za ile limit skończy się przy obecnym tempie. Po przekroczeniu 80% aplikacja ostrzeże raz na okno, żeby przypomnieć o przerwie albo /clear.',
  'help.wiedza.title': 'Wiedza i graf',
  'help.wiedza.body':
    'Panel Wiedza zbiera notatki .md projektu i utrzymuje konspekt, który Claude pobiera narzędziem MCP „konspekt". Graf wiedzy łączy notatki wikilinkami [[…]] — kolorowanie po autorze, funkcji, warstwie, tagach i świeżości, do tego szukajka, filtr legendy i ukrywanie notatek bez połączeń.',
  'help.skills.title': 'Skille i agenci',
  'help.skills.body':
    'Przegląd skilli (projektowych i osobistych), subagentów i reguł — z przełącznikami wł./wył. zapisywanymi w .claude/settings.local.json oraz kreatorami nowych. Cmd+klik wstawia /nazwę-skilla do sesji Claude; na dole liczniki linii plików CLAUDE.md.',
  'help.mcp.title': 'Serwery MCP',
  'help.mcp.body':
    'Serwery zdefiniowane w konfiguracji (local/user/project) wraz z rzeczywistym stanem połączenia z `claude mcp list`. Rozwinięcie węzła pokazuje szczegóły serwera.',
  'help.claude.title': 'Sesje Claude',
  'help.claude.body':
    'Przycisk ✳ na pasku tytułu loguje do konta Claude, a pigułka obok pokazuje limity planu (sesja 5h i tydzień). Karty Claude w dokach mają kropki statusu — pomarańczowa: skończył pracę, niebieska: czeka na zgodę — plus powiadomienia macOS i wznawianie zapisanych sesji przyciskiem ↺.',
  'help.docks.title': 'Doki i terminale',
  'help.docks.body':
    'Prawy i dolny dok mieszczą terminale oraz sesje Claude — to ta sama karta, różni się tylko komendą startową. Karty można dzielić w panele obok siebie, przeciągać między dokami i wyciągać do osobnych okien; procesy przy tym nie restartują.',
  'help.keys.title': 'Skróty klawiszowe',
  'help.keys.sidebar': 'pokaż/ukryj panel boczny',
  'help.keys.bottomDock': 'pokaż/ukryj dolny dok',
  'help.keys.rightDock': 'pokaż/ukryj prawy dok',
  'help.keys.quickOpen': 'szybkie otwieranie pliku po nazwie',
  'help.keys.save': 'zapisz plik',
  'help.keys.settings': 'ustawienia',
  'help.keys.daily': 'wyślij zaznaczenie do notatki dziennej Obsidiana',

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
  'skills.newAgent': '+ Nowy agent',
  'skills.newRule': '+ Nowa reguła',
  'agents.create.title': 'Nowy subagent',
  'agents.create.hint':
    'Subagent to plik .claude/agents/<nazwa>.md — opis mówi Claude, kiedy delegować zadanie, a treść jest promptem systemowym agenta.',
  'agents.create.name': 'Nazwa',
  'agents.create.namePh': 'np. recenzent-api',
  'agents.create.description': 'Opis (kiedy delegować)',
  'agents.create.descPh': 'Użyj do…',
  'agents.create.tools': 'Narzędzia (tools, opcjonalne — puste = wszystkie)',
  'agents.create.toolsPh': 'np. Read, Grep, Bash',
  'agents.create.model': 'Model',
  'agents.create.modelInherit': 'dziedziczy z sesji',
  'agents.create.body': 'Prompt systemowy',
  'agents.create.template': '## Rola\n\n…\n\n## Zasady\n\n- …\n',
  'agents.create.submit': 'Utwórz agenta',
  'agents.create.nameEmpty': 'Podaj nazwę agenta.',
  'agents.create.descRequired':
    'Opis jest wymagany — bez niego Claude nie wie, kiedy delegować do agenta.',
  'agents.create.exists': 'Agent o tej nazwie już istnieje.',
  'agents.create.failed': 'Nie udało się zapisać pliku agenta.',
  'agents.create.created': 'Utworzono agenta „{name}" — plik jest otwarty w edytorze.',
  'rules.create.title': 'Nowa reguła',
  'rules.create.hint':
    'Reguła to plik .claude/rules/<nazwa>.md doklejany do kontekstu sesji. Globy ścieżek ograniczają ją do pasujących plików; bez nich działa zawsze, jak CLAUDE.md.',
  'rules.create.name': 'Nazwa',
  'rules.create.namePh': 'np. konwencje-testow',
  'rules.create.paths': 'Ścieżki (paths, opcjonalne — globy po przecinku)',
  'rules.create.pathsPh': 'np. tests/**/*.ts, e2e/**',
  'rules.create.body': 'Treść reguły',
  'rules.create.template': '- …\n',
  'rules.create.submit': 'Utwórz regułę',
  'rules.create.nameEmpty': 'Podaj nazwę reguły.',
  'rules.create.exists': 'Reguła o tej nazwie już istnieje.',
  'rules.create.failed': 'Nie udało się zapisać pliku reguły.',
  'rules.create.created': 'Utworzono regułę „{name}" — plik jest otwarty w edytorze.',

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
  'usage.stale': 'Pokazuję ostatnie znane wartości.',
  'usage.warn': 'Limit sesji na {p}% — rozważ /clear albo krótszą przerwę.',
  'usage.forecast': 'przy obecnym tempie limit skończy się za {h} godz. {m} min',

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
  'main.usageRateLimited':
    'Za dużo zapytań o limity — odpocznę i spróbuję ponownie za ~{minutes} min.',
  'main.usageFetchFailed': 'Nie udało się pobrać limitów: {error}',
} as const;

export type StringKey = keyof typeof PL;

export const EN: Record<StringKey, string> = {
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
  'common.close': 'Close',
  'common.closeTab': 'Close tab',

  'titlebar.login': 'Sign in to your Claude account (opens `claude /login`)',
  'titlebar.settings': 'Settings (Cmd+,)',

  'sidebar.aria': 'Sidebar views',
  'sidebar.rail.files': 'Files',
  'sidebar.rail.search': 'Search in project',
  'sidebar.rail.git': 'Git history',
  'sidebar.rail.knowledge': 'Knowledge (MD files)',
  'sidebar.rail.skills': 'Skills and agents',
  'sidebar.rail.mcp': 'MCP servers',
  'sidebar.rail.sessions': 'Claude session history',
  'sidebar.view.search': 'Search',
  'sidebar.view.git': 'Git history',
  'sidebar.view.knowledge': 'Knowledge',
  'sidebar.view.skills': 'Skills and agents',
  'sidebar.view.mcp': 'MCP servers',
  'sidebar.view.sessions': 'Sessions',

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
  'dock.resume': 'Resume a saved Claude session of this project',
  'dock.resumeLoading': 'Looking for sessions…',
  'dock.resumeEmpty': 'No saved sessions for this project.',
  'dock.resumeTabTitle': 'Claude ↺',
  'dock.notifDone': 'Claude finished working',
  'dock.notifAttention': 'Claude is waiting for approval',
  'dock.notifBody': 'Tab “{title}” — come back to Sufler.',
  'dock.copyPrompt': 'Copy prompt: the selection, or the session’s last prompt when nothing is selected',
  'dock.copyPromptOk': 'Prompt copied to the clipboard.',
  'dock.copyPromptEmpty': 'Nothing to copy — select some text or send a prompt first.',
  'dock.copyPromptFailed': 'Could not copy to the clipboard.',

  'tabs.split': 'Split the workspace — a new editor group alongside',
  'tabs.preview': 'Browser preview (localhost) with element picking mode',
  'tabs.graphTitle': 'Knowledge graph',
  'tabs.settingsTitle': 'Settings',
  'tabs.helpTitle': 'Tutorial',
  'tabs.worklogTitle': 'Work history',
  'worklog.title': 'Work history',
  'worklog.subtitle':
    'Commits and session logs on one timeline — you can see which conversation led to which change.',
  'worklog.empty': 'Nothing yet — entries appear after your first commit or Claude session.',
  'worklog.commit': 'commit',
  'worklog.session': 'session',
  'worklog.operations': '{n} operations',
  'worklog.open': 'Work history — commits and sessions on a timeline',
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
  'settings.subtitle': 'Appearance, language and integrations — changes save instantly.',
  'settings.appearance': 'Appearance',
  'settings.appearanceHint': 'The theme and accent apply across the app, terminals included.',
  'settings.themeAria': 'Theme',
  'settings.accentAria': 'Accent color',
  'settings.language': 'Language / Język',
  'settings.project': 'Project',
  'settings.changeProject': 'Change project folder…',
  'settings.config': 'Configuration',
  'settings.configPath': 'Layout and app state: ~/.config/sufler/ (layout.json, state.json)',
  'knowledge.summarize': 'Summarize',
  'knowledge.summarizing': 'Summarizing…',
  'knowledge.summarizeHint':
    'Ask Claude to summarize the log (what was done, what is next) — the result lands at the top of the file. The call consumes your plan limit.',
  'knowledge.summarizeOk': 'Summary added at the top of the log.',
  'knowledge.summarizeShort': 'The log is too short to summarize.',
  'knowledge.summarizeFailed': 'Could not run `claude -p` — check your login and limits.',
  'knowledge.summarizeError': 'Could not save the summary.',
  'settings.sessionLog': 'Claude session log',
  'settings.sessionLogHint':
    'Sufler appends the course of work (prompts, edited files, commands) to a .md file in the dziennik-sesji/ folder. After `/clear`, open that file to pick up the thread without replaying the whole conversation — the simplest way to save context.',
  'settings.sessionLogSwitch': 'Record the session log',
  'settings.sessionLogGlobal': 'Also for sessions outside Sufler',
  'settings.sessionLogGlobalHint':
    'Installs a script in ~/.claude and wires it into the global Claude Code hooks, so the log is written for sessions started in a plain terminal too. Your other hooks stay untouched.',
  'settings.obsidianTitle': 'Obsidian — daily note',
  'settings.obsidianIntro': 'Optional. Requires the Local REST API plugin running in Obsidian.',
  'settings.obsidianApiKey': 'API key (Local REST API plugin)',
  'settings.obsidianUrl': 'Server address',
  'settings.obsidianDailyFile': 'Note file — {date} is today’s date',
  'settings.obsidianDailyHeading': 'Target heading',
  'settings.obsidianHint':
    'Select text in the editor and use Cmd+Shift+L (or the context menu) to append it under the chosen heading.',

  'obsidian.sendAction': 'Send selection to the daily note',
  'obsidian.sendOk': 'Appended to the daily note.',
  'obsidian.sendEmpty': 'Select some text to send first.',
  'obsidian.sendNotConfigured':
    'Complete the Obsidian configuration in Settings (API key, file, heading).',
  'obsidian.sendUnreachable':
    'Cannot reach Obsidian — launch Obsidian with the Local REST API plugin enabled.',
  'obsidian.sendRejected': 'Obsidian rejected the write — check the API key and heading.',

  'quickOpen.placeholder': 'Search files by name…',
  'quickOpen.empty': 'No matching files.',

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
  'unit.items': 'item|items',
  'unit.sessions': 'session|sessions',
  'unit.prompts': 'prompt|prompts',
  'unit.replies': 'reply|replies',
  'unit.tools': 'tool|tools',

  'ft.noAccess': 'No access',
  'ft.empty': '(empty)',
  'ft.openProject': 'Open project folder…',
  'ft.refresh': 'Refresh tree',
  'ft.showIgnored': 'Show files ignored by .gitignore',
  'ft.importDone': 'Added to the project: {count}',
  'ft.importSkipped': 'Skipped: {names}',
  'ft.importFailed': 'Importing dropped files failed',

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

  // Commit from the app (M69) — pick files, describe, commit
  'git.selectAll': 'All',
  'git.selectFile': 'Select for commit: {path}',
  'git.commitPlaceholder': 'Describe the change…',
  'git.commit': 'Commit ({count})',
  'git.commitHint': 'Select files and write a description to commit.',
  'git.commitWorking': 'Committing…',
  'git.commitDone': 'Committed {hash}: {subject}',
  'git.commitFailed': 'Could not commit the changes.',
  'git.commitIdentity': 'Git has no author configured — set `user.name` and `user.email` in a terminal.',
  'git.commitNothing': 'Nothing to commit — the selected files are gone from the list.',

  // Sessions panel (M67) — history of Claude conversations in this project
  'sessions.refresh': 'Refresh session list',
  'sessions.loading': 'Reading saved sessions…',
  'sessions.empty':
    'No saved sessions for this project — they appear after your first conversation with Claude.',
  'sessions.resume': 'Resume this conversation in a new tab (claude --resume)',
  'sessions.detailsLoading': 'Reading transcript…',
  'sessions.detailsFailed': 'Could not read the session transcript.',
  'sessions.started': 'Started: {when}',
  'sessions.lastActivity': 'Last activity: {when}',
  'sessions.previewTitle': 'Last exchanges',
  'sessions.previewTruncated': 'Earlier messages omitted.',
  'sessions.previewEmpty': 'This session has no messages to show.',
  'sessions.you': 'You',
  'sessions.claude': 'Claude',
  'sessions.branch': 'Branch at the time: {branch}',
  'checkpoints.title': 'Restore points',
  'checkpoints.hint':
    'A snapshot of the tree taken before each Claude turn. Restoring saves the current state first, so undoing can be undone too.',
  'checkpoints.empty': 'No snapshots yet — the first one appears with your first prompt to Claude.',
  'checkpoints.restore': 'Restore',
  'checkpoints.restoreTitle': 'Restore files from this snapshot?',
  'checkpoints.restoreMessage':
    'Project files will go back to the state “{label}”. The current state will be saved as a new snapshot.',
  'checkpoints.restored': 'Restored the snapshot.',
  'checkpoints.restoreFailed': 'Could not restore the snapshot.',
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
  'graph.modeTags': 'Tags',
  'graph.modeFresh': 'Freshness',
  'graph.titleTags': 'Note tags',
  'graph.titleFresh': 'Recent activity',
  'graph.noTags': '(no tags)',
  'graph.freshToday': 'Today',
  'graph.freshWeek': 'Past week',
  'graph.freshMonth': 'Past month',
  'graph.freshOlder': 'Older',
  'graph.searchPh': 'Search the graph…',
  'graph.hideOrphans': 'Hide orphans',
  'graph.orphansTitle': 'Hide notes without any connections',

  'help.open': 'Tutorial — how to use the app',
  'help.title': 'Sufler tutorial',
  'help.intro':
    'A quick tour of the window: the icon rail on the left switches project panels, the center is the editor, and the docks (right and bottom) hold Claude sessions and terminals.',
  'help.start.title': 'Getting started',
  'help.start.body':
    'Open a project folder (welcome screen or Settings → Change folder). Sufler works on the same directory as Claude Code — the panels only read the disk and configuration, so they will not break anything.',
  'help.files.title': 'Files',
  'help.files.body':
    'The project tree colors git statuses and hides .gitignore files by default (the eye icon toggles that). Click opens a file in the editor, double-click pins the tab, and the context menu inserts an @path straight into the active Claude session.',
  'help.search.title': 'Search and Cmd+P',
  'help.search.body':
    'The Search panel greps file contents (ripgrep) and opens matches in the editor. Cmd+P is quick open by file name, without leaving the keyboard.',
  'help.git.title': 'Git history',
  'help.git.body':
    'The commit list with the branch and a working-changes section. Clicking a file shows a Monaco diff, and change proposals from Claude (openDiff) come with Apply/Reject buttons.',
  'help.kontekst.title': 'Session log — saving context',
  'help.kontekst.body':
    'Every Claude session run inside Sufler appends the course of work to a file in dziennik-sesji/: your prompts, edited files and shell commands. That lets you use /clear freely — you pick up the thread by reading one short file instead of replaying the conversation. The “Summarize” button in the Knowledge panel asks Claude for a recap (what was done, what is next) at the top of the log. Settings can enable the log for sessions started outside the app too.',
  'help.ratunek.title': 'Restore points',
  'help.ratunek.body':
    'Before every Claude turn the app snapshots the project tree into a separate git ref — without touching your commits, branches or index. The list lives in the Git history panel; one click rolls files back, and the current state is saved as a new snapshot first, so undoing can be undone.',
  'help.historia.title': 'Work history',
  'help.historia.body':
    'The ◷ icon in the Git history panel opens a timeline where commits meet session logs, grouped by day. You can see which conversation led to which change; clicking a session opens its log.',
  'help.limity.title': 'Plan limits',
  'help.limity.body':
    'The pill in the title bar shows usage of the 5-hour window and the week. Click it for a forecast — when the limit runs out at the current pace. Above 80% the app warns once per window, as a nudge to take a break or run /clear.',
  'help.wiedza.title': 'Knowledge and graph',
  'help.wiedza.body':
    'The Knowledge panel gathers the project’s .md notes and maintains an outline that Claude fetches via the MCP “konspekt” tool. The knowledge graph links notes with [[wikilinks]] — coloring by author, function, layer, tags and freshness, plus search, legend filters and hiding unlinked notes.',
  'help.skills.title': 'Skills and agents',
  'help.skills.body':
    'An overview of skills (project and personal), subagents and rules — with on/off switches saved to .claude/settings.local.json and creators for new ones. Cmd+click inserts /skill-name into the Claude session; line counters for CLAUDE.md files sit at the bottom.',
  'help.mcp.title': 'MCP servers',
  'help.mcp.body':
    'Servers defined in configuration (local/user/project) together with their real connection state from `claude mcp list`. Expanding a node shows server details.',
  'help.claude.title': 'Claude sessions',
  'help.claude.body':
    'The ✳ button in the title bar logs into your Claude account, and the pill next to it shows plan limits (5h session and week). Claude tabs in the docks have status dots — orange: finished, blue: waiting for approval — plus macOS notifications and resuming saved sessions with ↺.',
  'help.docks.title': 'Docks and terminals',
  'help.docks.body':
    'The right and bottom docks hold terminals and Claude sessions — the same kind of tab, differing only in the start command. Tabs can be split into side-by-side panes, dragged between docks and detached into separate windows; processes survive all of it.',
  'help.keys.title': 'Keyboard shortcuts',
  'help.keys.sidebar': 'show/hide the sidebar',
  'help.keys.bottomDock': 'show/hide the bottom dock',
  'help.keys.rightDock': 'show/hide the right dock',
  'help.keys.quickOpen': 'quick open a file by name',
  'help.keys.save': 'save the file',
  'help.keys.settings': 'settings',
  'help.keys.daily': 'send the selection to the Obsidian daily note',

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
  'skills.newAgent': '+ New agent',
  'skills.newRule': '+ New rule',
  'agents.create.title': 'New subagent',
  'agents.create.hint':
    'A subagent is a .claude/agents/<name>.md file — the description tells Claude when to delegate, and the body is the agent’s system prompt.',
  'agents.create.name': 'Name',
  'agents.create.namePh': 'e.g. api-reviewer',
  'agents.create.description': 'Description (when to delegate)',
  'agents.create.descPh': 'Use for…',
  'agents.create.tools': 'Tools (optional — empty = all)',
  'agents.create.toolsPh': 'e.g. Read, Grep, Bash',
  'agents.create.model': 'Model',
  'agents.create.modelInherit': 'inherit from session',
  'agents.create.body': 'System prompt',
  'agents.create.template': '## Role\n\n…\n\n## Rules\n\n- …\n',
  'agents.create.submit': 'Create agent',
  'agents.create.nameEmpty': 'Enter an agent name.',
  'agents.create.descRequired':
    'The description is required — without it Claude does not know when to delegate to the agent.',
  'agents.create.exists': 'An agent with this name already exists.',
  'agents.create.failed': 'Failed to write the agent file.',
  'agents.create.created': 'Created agent “{name}” — the file is open in the editor.',
  'rules.create.title': 'New rule',
  'rules.create.hint':
    'A rule is a .claude/rules/<name>.md file appended to session context. Path globs scope it to matching files; without them it always applies, like CLAUDE.md.',
  'rules.create.name': 'Name',
  'rules.create.namePh': 'e.g. testing-conventions',
  'rules.create.paths': 'Paths (optional — comma-separated globs)',
  'rules.create.pathsPh': 'e.g. tests/**/*.ts, e2e/**',
  'rules.create.body': 'Rule text',
  'rules.create.template': '- …\n',
  'rules.create.submit': 'Create rule',
  'rules.create.nameEmpty': 'Enter a rule name.',
  'rules.create.exists': 'A rule with this name already exists.',
  'rules.create.failed': 'Failed to write the rule file.',
  'rules.create.created': 'Created rule “{name}” — the file is open in the editor.',

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
  'usage.stale': 'Showing the last known values.',
  'usage.warn': 'Session limit at {p}% — consider /clear or a short break.',
  'usage.forecast': 'at the current pace the limit runs out in {h} h {m} min',

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
  'main.usageRateLimited':
    'Too many limit requests — backing off, retrying in ~{minutes} min.',
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
