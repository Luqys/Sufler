import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { buildKnowledgeGraph } from './knowledge-graph';
import { OUTLINE_OUTPUT, rebuildOutline } from './knowledge';
import { getProjectRoot } from './project';

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
      '(tytuły, nagłówki, powiązania) z pliku konspekt-wiedzy.md w korzeniu repozytorium. ' +
      'Przed odczytem konspekt jest przeliczany, więc odpowiada aktualnemu stanowi notatek. ' +
      'Użyj na start, aby wiedzieć, co gdzie jest, zanim sięgniesz po pełne treści.',
    {},
    async () => {
      const root = getProjectRoot();
      if (!root) {
        return textResult('Brak otwartego projektu w Sufler.', true);
      }
      await rebuildOutline(root).catch(() => {
        // nie blokujemy odczytu — spróbujemy podać ostatnią wersję z repozytorium
      });
      try {
        return textResult(await readFile(join(root, OUTLINE_OUTPUT), 'utf8'));
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
  const port = wiedzaMcpPort();
  httpServer = createServer((request, response) => {
    handleRequest(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500).end();
      }
    });
  });
  httpServer.on('error', (error) => {
    startError = String((error as NodeJS.ErrnoException).code ?? error);
    httpServer = null;
  });
  httpServer.listen(port, '127.0.0.1');
}

export function getWiedzaMcpStatus(): { running: boolean; url: string; error: string | null } {
  return {
    running: httpServer !== null && httpServer.listening,
    url: wiedzaMcpUrl(),
    error: startError,
  };
}

export function stopWiedzaMcp(): void {
  httpServer?.close();
  httpServer = null;
}
