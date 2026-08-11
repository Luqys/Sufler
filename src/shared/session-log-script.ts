/**
 * Dziennik sesji poza Suflerem (M53): treść samodzielnego skryptu Node,
 * który aplikacja instaluje w katalogu konfiguracji Claude Code i wpina
 * w globalne hooki. Dzięki temu dziennik powstaje także dla sesji `claude`
 * uruchamianych w zwykłym terminalu — skrypt nie potrzebuje działającej
 * aplikacji, pisze wprost do katalogu projektu (`cwd` z ciała hooka).
 *
 * Logika odpowiada shared/session-log.ts; skrypt jest samodzielny, bo musi
 * działać bez bundla aplikacji.
 */

export const SESSION_LOG_SCRIPT_NAME = 'sufler-dziennik.mjs';

export const SESSION_LOG_SCRIPT = `#!/usr/bin/env node
// Dziennik sesji Claude Code — instalowany przez Sufler (M53).
// Czyta zdarzenie hooka ze stdin i dopisuje zwięzły wpis do
// <projekt>/dziennik-sesji/<data>-<sesja>.md. Nigdy nie przerywa sesji:
// każdy błąd kończy się cichym wyjściem z kodem 0.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const KIND = process.argv[2];
const LOGGED_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash']);

function condense(text, limit) {
  const single = String(text).replace(/\\s+/g, ' ').trim();
  return single.length <= limit ? single : single.slice(0, limit - 1) + '…';
}

function read() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

try {
  const payload = read();
  if (!payload || typeof payload.session_id !== 'string' || payload.session_id === '') {
    process.exit(0);
  }
  const root = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
  const now = new Date();
  const iso = now.toISOString();
  const time = iso.slice(11, 16);
  const short = payload.session_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'sesja';
  const file = join(root, 'dziennik-sesji', iso.slice(0, 10) + '-' + short + '.md');

  let entry = null;
  if (KIND === 'prompt') {
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
    if (prompt !== '') {
      entry = '\\n## ' + time + ' — polecenie\\n\\n' + condense(prompt, 400) + '\\n';
    }
  } else if (KIND === 'stop') {
    entry = '\\n_' + time + ' — Claude zakończył turę._\\n';
  } else if (KIND === 'tool' && LOGGED_TOOLS.has(payload.tool_name)) {
    const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
    if (payload.tool_name === 'Bash' && typeof input.command === 'string') {
      entry = '- \\\`' + time + '\\\` powłoka: \\\`' + condense(input.command, 160) + '\\\`\\n';
    } else {
      const path = input.file_path || input.notebook_path || input.path;
      if (typeof path === 'string' && path !== '') {
        const verb = payload.tool_name === 'Write' ? 'zapis' : 'edycja';
        entry = '- \\\`' + time + '\\\` ' + verb + ': \\\`' + path + '\\\`\\n';
      }
    }
  }
  if (!entry) {
    process.exit(0);
  }

  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) {
    const header = [
      '---',
      'kategoria: Dziennik sesji',
      'tagi: [dziennik, claude]',
      'sesja: ' + payload.session_id,
      'data: ' + iso,
      '---',
      '',
      '# Dziennik sesji — ' + basename(root),
      '',
      'Start: ' + iso,
      '',
      'Zapis prowadzony automatycznie (hooki Claude Code, instalacja z Suflera).',
      'Po wyczyszczeniu kontekstu wczytaj ten plik, aby wrócić do wątku.',
      '',
    ].join('\\n') + '\\n';
    writeFileSync(file, header, 'utf8');
  }
  appendFileSync(file, entry, 'utf8');
} catch {
  // cisza — dziennik nigdy nie może przerwać pracy z Claude
}
process.exit(0);
`;

/** Wpis hooka wołający skrypt dla danego rodzaju zdarzenia. */
function scriptHook(scriptPath: string, kind: 'prompt' | 'tool' | 'stop'): object {
  return {
    hooks: [
      { type: 'command', command: `node ${JSON.stringify(scriptPath)} ${kind}`, timeout: 5 },
    ],
  };
}

/** Czy w tablicy hooków siedzi już wpis wskazujący nasz skrypt. */
function hasScriptHook(entries: unknown, scriptPath: string): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => JSON.stringify(entry).includes(scriptPath))
  );
}

/**
 * Settings użytkownika po wpięciu (lub wypięciu) globalnych hooków dziennika.
 * Cudze hooki zostają nietknięte — dokładamy się do list, nie nadpisujemy ich.
 */
export function withGlobalSessionLogHooks(
  settings: Record<string, unknown>,
  scriptPath: string,
  enable: boolean,
): Record<string, unknown> {
  const hooksRaw = settings['hooks'];
  const hooks =
    typeof hooksRaw === 'object' && hooksRaw !== null && !Array.isArray(hooksRaw)
      ? { ...(hooksRaw as Record<string, unknown>) }
      : {};
  const events: Array<[string, 'prompt' | 'tool' | 'stop']> = [
    ['UserPromptSubmit', 'prompt'],
    ['PostToolUse', 'tool'],
    ['Stop', 'stop'],
  ];
  for (const [event, kind] of events) {
    const current = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : [];
    const without = current.filter((entry) => !JSON.stringify(entry).includes(scriptPath));
    if (enable) {
      hooks[event] = [...without, scriptHook(scriptPath, kind)];
    } else if (without.length > 0) {
      hooks[event] = without;
    } else {
      delete hooks[event];
    }
  }
  const next = { ...settings };
  if (Object.keys(hooks).length > 0) {
    next['hooks'] = hooks;
  } else {
    delete next['hooks'];
  }
  return next;
}

/** Czy globalne hooki dziennika są już wpięte. */
export function hasGlobalSessionLogHooks(
  settings: Record<string, unknown>,
  scriptPath: string,
): boolean {
  const hooksRaw = settings['hooks'];
  if (typeof hooksRaw !== 'object' || hooksRaw === null || Array.isArray(hooksRaw)) {
    return false;
  }
  const hooks = hooksRaw as Record<string, unknown>;
  return hasScriptHook(hooks['UserPromptSubmit'], scriptPath);
}
