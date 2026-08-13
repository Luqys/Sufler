import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useT } from './i18n';

/**
 * Wewnętrzne dialogi i toasty w stylu aplikacji — zamiast systemowych
 * window.confirm/alert.
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ToastTone = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface DialogsValue {
  confirmDialog(options: ConfirmOptions): Promise<boolean>;
  notify(message: string, tone?: ToastTone): void;
}

const DialogsContext = createContext<DialogsValue | null>(null);

export function useDialogs(): DialogsValue {
  const value = useContext(DialogsContext);
  if (!value) {
    throw new Error('useDialogs wymaga DialogProvider');
  }
  return value;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve(result: boolean): void;
}

let nextToastId = 1;

export function DialogProvider({ children }: { children: ReactNode }): ReactElement {
  const t = useT();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const confirmDialog = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      // Nowe pytanie zastępuje poprzednie (poprzednie = anulowane).
      pendingRef.current?.resolve(false);
      setPending({ options, resolve });
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    pendingRef.current?.resolve(result);
    setPending(null);
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextToastId++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        settle(false);
      } else if (event.key === 'Enter') {
        event.stopPropagation();
        settle(true);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pending, settle]);

  return (
    <DialogsContext.Provider value={{ confirmDialog, notify }}>
      {children}
      {pending && (
        <div className="settings-overlay confirm-overlay" onClick={() => settle(false)}>
          <div
            className="confirm-dialog"
            data-testid="confirm-dialog"
            role="alertdialog"
            onClick={(event) => event.stopPropagation()}
          >
            {pending.options.title && <h3 className="confirm-title">{pending.options.title}</h3>}
            <p className="confirm-message">{pending.options.message}</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="bar-btn"
                data-testid="confirm-cancel"
                onClick={() => settle(false)}
              >
                {pending.options.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                type="button"
                className={`confirm-accept${pending.options.danger ? ' danger' : ''}`}
                data-testid="confirm-accept"
                onClick={() => settle(true)}
              >
                {pending.options.confirmLabel ?? t('common.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.tone}`} data-testid="toast">
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </DialogsContext.Provider>
  );
}
