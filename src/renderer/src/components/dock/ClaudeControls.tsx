import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  effortCommand,
  modelCommand,
  planHandover,
  SHIFT_TAB,
  slashCommand,
  type ClaudeEffort,
  type ClaudeModel,
} from '../../../../shared/claude/controls';
import type { StringKey } from '../../../../shared/i18n';
import { t as tNow, tf, useT } from '../../i18n';
import { useDialogs } from '../../ui-dialogs';
import { useWorkspace } from '../../workspace';

const ICON_CONTROLS = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    <circle cx="5.5" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="10" cy="8" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="6.8" cy="11.5" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

const MODELE: Array<{ id: ClaudeModel; labelKey: StringKey }> = [
  { id: 'opus', labelKey: 'claudeCtl.modelOpus' },
  { id: 'sonnet', labelKey: 'claudeCtl.modelSonnet' },
  { id: 'haiku', labelKey: 'claudeCtl.modelHaiku' },
];

const WYSILEK: ClaudeEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

interface Props {
  /** Karta, do której piszemy — sterowanie dotyczy JEJ sesji, nie „aktywnej". */
  ptyId: number;
  /** Otwarcie nowej karty Claude z gotowym poleceniem przejęcia pracy. */
  onHandover(prompt: string): void;
  first: boolean;
  dockId: string;
}

/**
 * Sterowanie sesją Claude z paska karty (M84). Wszystko idzie do pty tej
 * karty: komendy ukośnikowe albo — dla trybu uprawnień — shift+tab, bo CLI
 * nie ma na niego komendy.
 */
export function ClaudeControls({ ptyId, onHandover, first, dockId }: Props): ReactElement {
  const t = useT();
  const { root } = useWorkspace();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const wyslij = (dane: string, komunikat?: StringKey): void => {
    window.api.ptyWrite(ptyId, dane);
    setOpen(false);
    if (komunikat) {
      notify(t(komunikat), 'info');
    }
  };

  /**
   * Przeniesienie rozmowy do nowej sesji z kontekstem: świeża sesja startuje
   * pusta, więc kontekst przenosi DZIENNIK (M52) ze streszczeniem (M54).
   */
  const przeniesRozmowe = (): void => {
    setBusy(true);
    // Oś czasu pracy (M56) zna dzienniki sesji z datami — nie trzeba drugiego
    // źródła prawdy o tym, która sesja była ostatnia.
    void window.api.getWorklog(root).then(async (wpisy) => {
      const dzienniki = wpisy
        .filter((wpis) => wpis.kind === 'session')
        .map((wpis) => ({ path: wpis.reference, mtimeMs: Date.parse(wpis.date) || 0 }));
      const plan = planHandover(dzienniki);
      if (!plan) {
        setBusy(false);
        setOpen(false);
        notify(tNow('claudeCtl.handoverNoLog'), 'error');
        return;
      }
      // Streszczenie na górze dziennika skraca nowej sesji drogę do sedna.
      const wynik = await window.api.summarizeSessionLog(root, plan.logPath);
      setBusy(false);
      setOpen(false);
      onHandover(plan.prompt);
      notify(
        wynik.ok
          ? tf('claudeCtl.handoverDone', { plik: plan.logPath })
          : tf('claudeCtl.handoverNoSummary', { plik: plan.logPath }),
        wynik.ok ? 'success' : 'info',
      );
    });
  };

  return (
    <div className="dock-resume-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`dock-add${open ? ' active' : ''}`}
        data-testid={first ? `${dockId}-claude-controls` : undefined}
        title={t('claudeCtl.title')}
        onClick={() => setOpen((current) => !current)}
      >
        {ICON_CONTROLS}
      </button>
      {open && (
        <div
          className="dock-resume-menu claude-controls"
          data-testid={first ? `${dockId}-claude-controls-menu` : undefined}
        >
          <div className="claude-controls-group">
            <span className="claude-controls-label">{t('claudeCtl.model')}</span>
            <div className="claude-controls-row">
              {MODELE.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className="bar-btn"
                  data-testid={`claude-model-${model.id}`}
                  onClick={() => wyslij(modelCommand(model.id), 'claudeCtl.sent')}
                >
                  {t(model.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="claude-controls-group">
            <span className="claude-controls-label">{t('claudeCtl.effort')}</span>
            <div className="claude-controls-row">
              {WYSILEK.map((poziom) => (
                <button
                  key={poziom}
                  type="button"
                  className="bar-btn"
                  data-testid={`claude-effort-${poziom}`}
                  title={t('claudeCtl.effortHint')}
                  onClick={() => wyslij(effortCommand(poziom), 'claudeCtl.sent')}
                >
                  {poziom}
                </button>
              ))}
            </div>
          </div>

          <div className="claude-controls-group">
            <span className="claude-controls-label">{t('claudeCtl.session')}</span>
            <div className="claude-controls-row">
              <button
                type="button"
                className="bar-btn"
                data-testid="claude-permission-cycle"
                title={t('claudeCtl.permissionHint')}
                onClick={() => wyslij(SHIFT_TAB)}
              >
                {t('claudeCtl.permission')}
              </button>
              <button
                type="button"
                className="bar-btn"
                data-testid="claude-compact"
                title={t('claudeCtl.compactHint')}
                onClick={() => wyslij(slashCommand('compact'), 'claudeCtl.sent')}
              >
                /compact
              </button>
              <button
                type="button"
                className="bar-btn"
                data-testid="claude-clear"
                title={t('claudeCtl.clearHint')}
                onClick={() => wyslij(slashCommand('clear'), 'claudeCtl.sent')}
              >
                /clear
              </button>
            </div>
            <div className="claude-controls-row">
              <button
                type="button"
                className="bar-btn"
                data-testid="claude-mcp"
                onClick={() => wyslij(slashCommand('mcp'), 'claudeCtl.sent')}
              >
                /mcp
              </button>
              <button
                type="button"
                className="bar-btn"
                data-testid="claude-login"
                onClick={() => wyslij(slashCommand('login'), 'claudeCtl.sent')}
              >
                /login
              </button>
            </div>
          </div>

          <button
            type="button"
            className="welcome-submit claude-controls-handover"
            data-testid="claude-handover"
            disabled={busy}
            title={t('claudeCtl.handoverHint')}
            onClick={przeniesRozmowe}
          >
            {busy ? t('claudeCtl.handoverBusy') : t('claudeCtl.handover')}
          </button>
        </div>
      )}
    </div>
  );
}
