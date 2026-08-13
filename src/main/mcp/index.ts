import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { McpStatusResult } from '../../shared/ipc';
import type { McpConfigServer, McpDetail } from '../../shared/mcp/mcp';
import { resolveShellEnv } from '../system/shell-env';
import { parseClaudeJsonServers, parseMcpGetOutput, parseMcpJson, parseMcpListOutput } from './parse';

const execFileAsync = promisify(execFile);

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export function mcpConfigFiles(root: string): string[] {
  return [join(homedir(), '.claude.json'), join(root, '.mcp.json')];
}

/** Konfiguracja mówi, co jest ZDEFINIOWANE. Kolejność scope'ów: local, project, user. */
export async function readMcpConfig(root: string): Promise<McpConfigServer[]> {
  const [claudeJson, mcpJson] = await Promise.all([
    readTextIfExists(join(homedir(), '.claude.json')),
    readTextIfExists(join(root, '.mcp.json')),
  ]);
  const fromClaude = claudeJson
    ? parseClaudeJsonServers(claudeJson, root)
    : { user: [], local: [] };
  const fromProject = mcpJson ? parseMcpJson(mcpJson) : [];
  return [...fromClaude.local, ...fromProject, ...fromClaude.user];
}

async function runClaudeMcp(root: string, args: string[]): Promise<string> {
  const env = await resolveShellEnv();
  const { stdout } = await execFileAsync('claude', ['mcp', ...args], {
    cwd: root,
    env,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

/** CLI mówi, co jest POŁĄCZONE. Wolne — wywoływane tylko na żądanie, bez pollingu. */
export async function runMcpList(root: string): Promise<McpStatusResult> {
  try {
    return { ok: true, entries: parseMcpListOutput(await runClaudeMcp(root, ['list'])) };
  } catch (error) {
    const withOutput = error as { stdout?: string; code?: string; message?: string };
    if (typeof withOutput.stdout === 'string' && withOutput.stdout.length > 0) {
      return { ok: true, entries: parseMcpListOutput(withOutput.stdout) };
    }
    if (withOutput.code === 'ENOENT') {
      return { ok: false, error: 'Nie znaleziono binarki `claude` w PATH.' };
    }
    return { ok: false, error: withOutput.message ?? String(error) };
  }
}

export async function runMcpGet(root: string, name: string): Promise<McpDetail[]> {
  try {
    return parseMcpGetOutput(await runClaudeMcp(root, ['get', name]));
  } catch (error) {
    const withOutput = error as { stdout?: string };
    if (typeof withOutput.stdout === 'string') {
      return parseMcpGetOutput(withOutput.stdout);
    }
    return [];
  }
}
