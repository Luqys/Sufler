import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type ReactElement,
} from 'react';
import { CHAT_PATH } from '../../../shared/chat';
import type { DockId } from '../../../shared/dock-tabs';
import { quotePathForPrompt } from '../../../shared/media';
import { baseName } from '../../../shared/paths';
import { getChatState, interruptChat, resetChat, sendChat, subscribeChat } from '../chat-store';
import { useDocks } from '../docks';
import { tf, useT } from '../i18n';
import { useDialogs } from '../ui-dialogs';
import { useWorkspace } from '../workspace';

const ICON_TOOL = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.8 3.2a3.4 3.4 0 0 1 4.5-.9L11.9 4.7l1.4 1.4 2.4-2.4a3.4 3.4 0 0 1-4.6 4.5L5.5 13.8a1.5 1.5 0 0 1-2.1-2.1l5.6-5.6a3.4 3.4 0 0 1 .8-2.9Z" transform="scale(0.9)" />
  </svg>
);

const ICON_SEND = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
  </svg>
);

const ICON_STOP = (
  <svg width="11" height="11" viewBox="0 0 16 16">
    <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
  </svg>
);

const ICON_RESET = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.8 8a5.2 5.2 0 1 1 1.5 3.7" />
    <path d="M2.6 8.2V4.9M2.6 8.2h3.3" transform="translate(0 3.2)" />
  </svg>
);

const ICON_PLUS = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

/** Ramka okna z podświetloną strefą — przyciski „otwórz czat w…". */
function placeIcon(zone: 'editor' | 'right' | 'bottom'): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.5" />
      {zone === 'editor' && <rect x="3.4" y="4" width="6.2" height="8" fill="currentColor" stroke="none" opacity="0.55" />}
      {zone === 'right' && <rect x="10" y="4" width="2.7" height="8" fill="currentColor" stroke="none" opacity="0.55" />}
      {zone === 'bottom' && <rect x="3.4" y="9.4" width="9.3" height="2.6" fill="currentColor" stroke="none" opacity="0.55" />}
    </svg>
  );
}

/** Piksel-robot z ekranu powitalnego (jak w panelu Claude Code). */
const ROBOT = (
  <svg width="66" height="54" viewBox="0 0 24 20" className="chat-robot" aria-hidden="true">
    <rect x="6" y="0" width="2" height="3" fill="currentColor" />
    <rect x="16" y="0" width="2" height="3" fill="currentColor" />
    <rect x="3" y="3" width="18" height="10" rx="1" fill="currentColor" />
    <rect x="7" y="6" width="2.6" height="3.6" fill="var(--bg)" />
    <rect x="14.4" y="6" width="2.6" height="3.6" fill="var(--bg)" />
    <rect x="4.6" y="13" width="2.4" height="4" fill="currentColor" />
    <rect x="9.4" y="13" width="2.4" height="6" fill="currentColor" />
    <rect x="12.2" y="13" width="2.4" height="6" fill="currentColor" />
    <rect x="17" y="13" width="2.4" height="4" fill="currentColor" />
  </svg>
);

interface ChatViewProps {
  /** Gdzie czat jest wyrenderowany: obszar edytora czy jeden z doków. */
  place?: 'editor' | DockId;
  /** Id karty doku — potrzebne do zamknięcia przy przenosinach z doku. */
  dockTabId?: string;
}

const PLACE_LABEL_KEYS = {
  editor: 'chat.moveEditor',
  right: 'chat.moveRight',
  bottom: 'chat.moveBottom',
} as const;

/** Czat z Claude: silnik Claude Code (Agent SDK), historia dymków + narzędzia. */
export function ChatView({ place = 'editor', dockTabId }: ChatViewProps): ReactElement {
  const { root, openChat, closeTab: closeEditorTab } = useWorkspace();
  const { openChatTab, closeTab: closeDockTab } = useDocks();
  const { notify } = useDialogs();
  const t = useT();
  const state = useSyncExternalStore(subscribeChat, getChatState);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  /** Przenosiny całego czatu: edytor ↔ doki. Historia żyje w chat-store. */
  const moveTo = (target: 'editor' | DockId): void => {
    if (target === place) {
      return;
    }
    if (target === 'editor') {
      openChat();
    } else {
      // Ukryty dok musi się pokazać, inaczej czat „zniknie" (słucha Workbench).
      window.dispatchEvent(new CustomEvent('vn3o:reveal-dock', { detail: target }));
      openChatTab(target);
    }
    if (place === 'editor') {
      closeEditorTab(CHAT_PATH);
    } else if (target === 'editor' && dockTabId) {
      closeDockTab(dockTabId);
    }
  };

  const insertImagePath = (path: string): void => {
    setDraft((current) => {
      const lead = current && !current.endsWith(' ') ? `${current} ` : current;
      return `${lead}${quotePathForPrompt(path)} `;
    });
    inputRef.current?.focus();
  };

  const attachFromClipboard = (): void => {
    void window.api.saveClipboardImage().then((saved) => {
      if (saved.ok) {
        insertImagePath(saved.path);
      } else {
        notify(t('chat.noClipboardImage'));
      }
    });
  };

  /** Wklejenie obrazka (bez tekstu) → ścieżka pliku tymczasowego do promptu. */
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const data = event.clipboardData;
    const hasText = data.types.includes('text/plain');
    const hasImage = Array.from(data.items).some((item) => item.type.startsWith('image/'));
    if (hasImage && !hasText) {
      event.preventDefault();
      void window.api.saveClipboardImage().then((saved) => {
        if (saved.ok) {
          insertImagePath(saved.path);
        }
      });
    }
  };

  const otherPlaces = (['editor', 'right', 'bottom'] as const).filter((zone) => zone !== place);

  return (
    <div className="chat-view" data-testid="chat-view">
      <div className="chat-toolbar">
        <span className="chat-title">
          <span className="chat-title-spark">✳</span> Claude Code
        </span>
        <span className="chat-hint" title={root}>
          {baseName(root)}
          {state.costUsd !== null && state.costUsd > 0 && ` · $${state.costUsd.toFixed(2)}`}
        </span>
        {otherPlaces.map((zone) => (
          <button
            key={zone}
            type="button"
            className="chat-toolbtn"
            data-testid={`chat-move-${zone}`}
            title={t(PLACE_LABEL_KEYS[zone])}
            onClick={() => moveTo(zone)}
          >
            {placeIcon(zone)}
          </button>
        ))}
        <button
          type="button"
          className="chat-toolbtn"
          data-testid="chat-reset"
          disabled={state.entries.length === 0}
          title={t('chat.reset')}
          onClick={resetChat}
        >
          {ICON_RESET}
        </button>
      </div>
      <div className="chat-list" ref={listRef}>
        {state.entries.length === 0 && (
          <div className="chat-empty">
            {ROBOT}
            <p className="chat-empty-title">{t('chat.emptyTitle')}</p>
            <p className="placeholder">{tf('chat.emptyBody', { root: baseName(root) })}</p>
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
        {state.busy && <div className="chat-typing">{t('chat.busy')}</div>}
      </div>
      <form
        className="chat-inputbar"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="chat-inputbox">
          <textarea
            ref={inputRef}
            className="chat-input"
            data-testid="chat-input"
            placeholder={t('chat.placeholder')}
            value={draft}
            rows={Math.min(6, draft.split('\n').length)}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={onPaste}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className="chat-inputrow">
            <button
              type="button"
              className="chat-attach"
              data-testid="chat-attach"
              title={t('chat.attach')}
              onClick={attachFromClipboard}
            >
              {ICON_PLUS}
            </button>
            <span className="chat-input-hint">{t('chat.inputHint')}</span>
            {state.busy ? (
              <button
                type="button"
                className="chat-send stop"
                data-testid="chat-interrupt"
                title={t('chat.interrupt')}
                onClick={interruptChat}
              >
                {ICON_STOP}
              </button>
            ) : (
              <button
                type="submit"
                className="chat-send"
                data-testid="chat-send"
                disabled={!draft.trim()}
                title={t('chat.send')}
              >
                {ICON_SEND}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
