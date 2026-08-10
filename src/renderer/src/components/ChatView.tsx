import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import { baseName } from '../../../shared/paths';
import { getChatState, interruptChat, resetChat, sendChat, subscribeChat } from '../chat-store';
import { useWorkspace } from '../workspace';

const ICON_TOOL = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.8 3.2a3.4 3.4 0 0 1 4.5-.9L11.9 4.7l1.4 1.4 2.4-2.4a3.4 3.4 0 0 1-4.6 4.5L5.5 13.8a1.5 1.5 0 0 1-2.1-2.1l5.6-5.6a3.4 3.4 0 0 1 .8-2.9Z" transform="scale(0.9)" />
  </svg>
);

/** Czat z Claude: silnik Claude Code (Agent SDK), historia dymków + narzędzia. */
export function ChatView(): ReactElement {
  const { root } = useWorkspace();
  const state = useSyncExternalStore(subscribeChat, getChatState);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state.entries.length, state.busy]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text || state.busy) {
      return;
    }
    setDraft('');
    sendChat(root, text);
  };

  return (
    <div className="chat-view" data-testid="chat-view">
      <div className="chat-toolbar">
        <span className="chat-title">Czat z Claude</span>
        <span className="chat-hint" title={root}>
          silnik Claude Code · {baseName(root)}
          {state.costUsd !== null && state.costUsd > 0 && ` · $${state.costUsd.toFixed(2)}`}
        </span>
        {state.busy ? (
          <button type="button" className="bar-btn" data-testid="chat-interrupt" onClick={interruptChat}>
            Przerwij
          </button>
        ) : (
          <button
            type="button"
            className="bar-btn"
            data-testid="chat-reset"
            disabled={state.entries.length === 0}
            onClick={resetChat}
          >
            Nowa rozmowa
          </button>
        )}
      </div>
      <div className="chat-list" ref={listRef}>
        {state.entries.length === 0 && (
          <div className="chat-empty">
            <p className="chat-empty-title">✳</p>
            <p className="placeholder">
              Rozmawiasz z Claude nad projektem {baseName(root)} — z dostępem do plików
              i narzędzi, na Twoim logowaniu Claude Code.
            </p>
          </div>
        )}
        {state.entries.map((entry, index) => {
          if (entry.role === 'tool') {
            return (
              <div key={index} className="chat-tool">
                {ICON_TOOL}
                <span className="chat-tool-name">{entry.tool}</span>
                {entry.text && <span className="chat-tool-detail">{entry.text}</span>}
              </div>
            );
          }
          return (
            <div key={index} className={`chat-msg ${entry.role}`}>
              {entry.text}
            </div>
          );
        })}
        {state.busy && <div className="chat-typing">Claude pracuje…</div>}
      </div>
      <form
        className="chat-inputbar"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          className="chat-input"
          data-testid="chat-input"
          placeholder="Napisz do Claude… (Enter wysyła, Shift+Enter — nowa linia)"
          value={draft}
          rows={Math.min(6, draft.split('\n').length)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          className="chat-send"
          data-testid="chat-send"
          disabled={state.busy || !draft.trim()}
          title="Wyślij (Enter)"
        >
          Wyślij
        </button>
      </form>
    </div>
  );
}
