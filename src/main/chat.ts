import type { BrowserWindow } from 'electron';
import { summarizeToolInput, type ChatStreamEvent } from '../shared/chat';
import { IPC } from '../shared/ipc';
import { resolveShellEnv } from './shell-env';

/**
 * Tryb czatu: most do Claude Agent SDK (silnik Claude Code jako biblioteka).
 * SDK sam znajduje logowanie Claude Code (Keychain), więc zużycie liczy się
 * do planu użytkownika. Jedna rozmowa na okno ('main'), wznawiana po stronie
 * SDK przez session_id.
 */

const CHAT_ID = 'main';

/** Luźny kształt wiadomości SDK — odporny na drobne zmiany typów pakietu. */
interface SdkContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

interface SdkMessage {
  type: string;
  session_id?: string;
  total_cost_usd?: number;
  message?: { content?: SdkContentBlock[] };
}

interface ChatSessionState {
  sessionId: string | null;
  interrupt: (() => void) | null;
}

const state: ChatSessionState = { sessionId: null, interrupt: null };

function emit(win: BrowserWindow, event: ChatStreamEvent): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC.ChatEvent, { chatId: CHAT_ID, event });
  }
}

/** Atrapa do hermetycznych testów e2e (VISUALN3O_CHAT_FAKE=1). */
async function runFake(win: BrowserWindow, prompt: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 60));
  emit(win, { kind: 'tool', name: 'Read', detail: 'README.md' });
  emit(win, { kind: 'text', text: `Atrapa odpowiedzi na: ${prompt}` });
  emit(win, { kind: 'done', sessionId: 'fake', costUsd: null });
}

export async function sendChatMessage(
  win: BrowserWindow,
  root: string,
  prompt: string,
): Promise<{ ok: boolean; error?: string }> {
  if (process.env['VISUALN3O_CHAT_FAKE']) {
    await runFake(win, prompt);
    return { ok: true };
  }

  let finished = false;
  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const env = await resolveShellEnv();
    const q = query({
      prompt,
      options: {
        cwd: root,
        env: { ...process.env, ...env },
        resume: state.sessionId ?? undefined,
        // Jak „auto mode" w terminalowych sesjach Claude tej aplikacji.
        permissionMode: 'bypassPermissions',
      },
    });
    state.interrupt = () => {
      void q.interrupt().catch(() => {});
    };

    for await (const raw of q) {
      const message = raw as unknown as SdkMessage;
      if (message.session_id) {
        state.sessionId = message.session_id;
      }
      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if (block.type === 'text' && block.text?.trim()) {
            emit(win, { kind: 'text', text: block.text });
          } else if (block.type === 'tool_use' && block.name) {
            emit(win, { kind: 'tool', name: block.name, detail: summarizeToolInput(block.input) });
          }
        }
      } else if (message.type === 'result') {
        finished = true;
        emit(win, {
          kind: 'done',
          sessionId: state.sessionId ?? '',
          costUsd: typeof message.total_cost_usd === 'number' ? message.total_cost_usd : null,
        });
      }
    }
    return { ok: true };
  } catch (error) {
    finished = true;
    const description = error instanceof Error ? error.message : String(error);
    emit(win, { kind: 'error', message: `Nie udało się porozmawiać z Claude: ${description}` });
    return { ok: false, error: description };
  } finally {
    state.interrupt = null;
    if (!finished) {
      // Przerwana tura (interrupt) — domknij stan „pracuje" w UI.
      emit(win, { kind: 'done', sessionId: state.sessionId ?? '', costUsd: null });
    }
  }
}

export function interruptChat(): void {
  state.interrupt?.();
}

/** Nowa rozmowa: porzuca session_id (SDK zacznie świeżą sesję). */
export function resetChat(): void {
  state.interrupt?.();
  state.sessionId = null;
}
