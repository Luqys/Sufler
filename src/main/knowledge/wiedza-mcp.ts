import { BrowserWindow } from 'electron';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { buildKnowledgeGraph } from './knowledge-graph';
import { buildProjectOutline } from './knowledge';
import { createSkill, readSkillsSnapshot } from '../skills/skills';
import { getProjectRoot } from '../project/project';
import { IPC } from '../../shared/ipc';

/** Wspólny wycinek pól skilla do listy MCP. */
function pick(skill: { name: string; description: string; enabled: boolean }): {
  nazwa: string;
  opis: string;
  wlaczony: boolean;
} {
  return { nazwa: skill.name, opis: skill.description, wlaczony: skill.enabled };
}

/**
 * Serwer MCP grafu wiedzy: Claude Code dostaje schemat połączeń notatek .md
 * projektu (co jest z czym powiązane, kto ostatnio zmieniał) bez sklejania
 * wszystkiego w jeden plik. Transport: streamable HTTP na loopbacku,
 * tryb bezstanowy (nowy serwer per żądanie).
 */

const DEFAULT_PORT = 30140;

export function wiedzaMcpPort(): number {
  const fromEnv = Number(process.env['VISUALN3O_MCP_PORT']);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_PORT;
}

export function wiedzaMcpUrl(): string {
  return `http://127.0.0.1:${wiedzaMcpPort()}/mcp`;
}

function textResult(text: string, isError = false): {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
} {
  return isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] };
}

function buildMcp(): McpServer {
  const mcp = new McpServer({ name: 'sufler-graf-wiedzy', version: '1.0.0' });

  mcp.tool(
    'konspekt',
    'Konspekt wiedzy projektu otwartego w Sufler — mapa wszystkich notatek .md ' +
      '(tytuły, nagłówki, powiązania) notatek .md projektu. Liczony na żądanie, ' +
      'więc zawsze odpowiada aktualnemu stanowi notatek. ' +
      'Użyj na start, aby wiedzieć, co gdzie jest, zanim sięgniesz po pełne treści.',
    {},
    async () => {
      const root = getProjectRoot();
      if (!root) {
        return textResult('Brak otwartego projektu w Sufler.', true);
      }
      try {
        // Liczone na żądanie i zwracane wprost — bez pliku pośredniego w projekcie.
        return textResult(await buildProjectOutline(root));
      } catch {
        return textResult('Nie udało się zbudować konspektu wiedzy.', true);
      }
    },
  );

  mcp.tool(
    'graf_wiedzy',
    'Pełny schemat grafu wiedzy projektu otwartego w Sufler: notatki .md jako węzły ' +
      '(ścieżka, tytuł, autor ostatniej zmiany, data, kategoria funkcji programu, ' +
      'warstwa frontend/backend) i połączenia między nimi (wikilinki [[...]] i linki ' +
      'markdown). Kategorię i warstwę można nadpisać frontmatterem notatki ' +
      '(`kategoria:`, `warstwa:`). Użyj, gdy potrzebujesz pełnej struktury połączeń; ' +
      'szybki spis tematów daje narzędzie konspekt.',
    {},
    async () => {
      const root = getProjectRoot();
      if (!root) {
        return textResult('Brak otwartego projektu w Sufler.', true);
      }
      return textResult(JSON.stringify(await buildKnowledgeGraph(root), null, 1));
    },
  );

  mcp.tool(
    'skille_lista',
    'Spis skilli widocznych w panelu Sufler (projektowe i osobiste) z opisem i stanem ' +
      'włączenia (skillOverrides). Sprawdź przed utworzeniem nowego skilla.',
    {},
    async () => {
      const root = getProjectRoot();
      if (!root) {
        return textResult('Brak otwartego projektu w Sufler.', true);
      }
      const snapshot = await readSkillsSnapshot(root);
      const entries = [
        ...snapshot.projectSkills.map((skill) => ({ zakres: 'projekt', ...pick(skill) })),
        ...snapshot.personalSkills.map((skill) => ({ zakres: 'osobisty', ...pick(skill) })),
      ];
      return textResult(JSON.stringify(entries, null, 1));
    },
  );

  mcp.tool(
    'skill_nowy',
    'Tworzy skill (katalog z SKILL.md) widoczny od razu w panelu Sufler. Nazwa kebab-case, ' +
      'opis mówi Claude, kiedy po niego sięgać, treść to instrukcje markdown.',
    {
      nazwa: z.string().describe('Nazwa skilla (kebab-case), np. generator-changelog'),
      opis: z.string().describe('Opis — kiedy używać skilla'),
      tresc: z.string().optional().describe('Instrukcje markdown (opcjonalne)'),
      zakres: z
        .enum(['projekt', 'osobisty'])
        .optional()
        .describe('Domyślnie projekt (.claude/skills); osobisty = ~/.claude/skills'),
    },
    async ({ nazwa, opis, tresc, zakres }) => {
      const root = getProjectRoot();
      if (!root) {
        return textResult('Brak otwartego projektu w Sufler.', true);
      }
      const result = await createSkill(root, {
        scope: zakres === 'osobisty' ? 'personal' : 'project',
        name: nazwa,
        description: opis,
        manual: false,
        body: tresc ?? '',
      });
      if (!result.ok) {
        const message =
          result.error === 'invalid-name'
            ? 'Niepoprawna nazwa — kebab-case: małe litery, cyfry, pojedyncze myślniki.'
            : result.error === 'exists'
              ? 'Skill o tej nazwie już istnieje w tym zakresie.'
              : 'Nie udało się zapisać SKILL.md.';
        return textResult(message, true);
      }
      // Panel odświeżamy wprost: chokidar potrafi zgłosić nowy katalog, zanim
      // powstanie w nim SKILL.md, i wtedy skill pojawiłby się dopiero przy
      // kolejnej zmianie na dysku.
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.SkillsChanged);
        }
      }
      return textResult(`Utworzono skill: ${result.path}`);
    },
  );

  mcp.tool(
    'notatka',
    'Pełna treść notatki .md z projektu. Parametr: sciezka względna (id węzła z graf_wiedzy).',
    { sciezka: z.string().describe('Ścieżka względna notatki, np. docs/architektura.md') },
    async ({ sciezka }) => {
      const root = getProjectRoot();
      if (!root) {
        return textResult('Brak otwartego projektu w Sufler.', true);
      }
      const absolute = resolve(join(root, sciezka));
      if (!absolute.startsWith(`${resolve(root)}/`) || !absolute.endsWith('.md')) {
        return textResult('Niedozwolona ścieżka — tylko pliki .md wewnątrz projektu.', true);
      }
      try {
        return textResult(await readFile(absolute, 'utf8'));
      } catch {
        return textResult(`Nie można odczytać notatki: ${sciezka}`, true);
      }
    },
  );

  mcp.tool(
    'powiazania',
    'Bezpośredni sąsiedzi notatki w grafie wiedzy: z czym jest powiązana (w obie strony).',
    { notatka: z.string().describe('Ścieżka względna notatki, np. docs/architektura.md') },
    async ({ notatka }) => {
      const root = getProjectRoot();
      if (!root) {
        return textResult('Brak otwartego projektu w Sufler.', true);
      }
      const graph = await buildKnowledgeGraph(root);
      const neighbors = new Set<string>();
      for (const edge of graph.edges) {
        if (edge.from === notatka) {
          neighbors.add(edge.to);
        }
        if (edge.to === notatka) {
          neighbors.add(edge.from);
        }
      }
      const nodes = graph.nodes.filter((node) => neighbors.has(node.id));
      if (nodes.length === 0) {
        return textResult(`Notatka „${notatka}" nie ma powiązań (albo nie istnieje w grafie).`);
      }
      return textResult(JSON.stringify(nodes, null, 1));
    },
  );

  return mcp;
}

let httpServer: Server | null = null;
let startError: string | null = null;
/** Zatrzymany na życzenie (zamykanie aplikacji) — wtedy nie ponawiamy startu. */
let stopped = false;
let startAttempts = 0;
let retryTimer: NodeJS.Timeout | null = null;

/** Ile razy próbujemy zająć port i co ile — port bywa jeszcze trzymany przez zamykaną instancję. */
const START_RETRIES = 5;
const RETRY_DELAY_MS = 700;

/**
 * Panel Wiedza czytał status raz, przy montowaniu — a `listen()` jest
 * asynchroniczny, więc sekcja MCP potrafiła zostać na „uruchamianie" do końca
 * życia okna (zgłoszenie „ta sekcja nie zawsze działa"). Teraz każda zmiana
 * stanu leci do okien.
 */
function broadcastStatus(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.WiedzaMcpChanged);
    }
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!request.url?.startsWith('/mcp')) {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  let body: unknown;
  try {
    body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
  } catch {
    response.writeHead(400).end();
    return;
  }
  const mcp = buildMcp();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  response.on('close', () => {
    void transport.close();
    void mcp.close();
  });
  await mcp.connect(transport);
  await transport.handleRequest(request, response, body);
}

export function startWiedzaMcp(): void {
  stopped = false;
  startAttempts += 1;
  const port = wiedzaMcpPort();
  const server = createServer((request, response) => {
    handleRequest(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500).end();
      }
    });
  });
  httpServer = server;
  server.on('error', (error) => {
    startError = String((error as NodeJS.ErrnoException).code ?? error);
    httpServer = null;
    broadcastStatus();
    // Zajęty port to zwykle poprzednia instancja w trakcie zamykania —
    // kilka podejść wystarcza, żeby serwer wstał bez restartu aplikacji.
    if (!stopped && startAttempts < START_RETRIES) {
      retryTimer = setTimeout(startWiedzaMcp, RETRY_DELAY_MS);
      retryTimer.unref?.();
    }
  });
  server.listen(port, '127.0.0.1', () => {
    startError = null;
    broadcastStatus();
  });
}

export function getWiedzaMcpStatus(): { running: boolean; url: string; error: string | null } {
  return {
    running: httpServer !== null && httpServer.listening,
    url: wiedzaMcpUrl(),
    error: startError,
  };
}

export function stopWiedzaMcp(): void {
  stopped = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  httpServer?.close();
  httpServer = null;
}
