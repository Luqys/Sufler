import { useEffect, type ReactElement } from 'react';
import type { DetachedTarget } from '../../../../shared/docks/detached';
import { applyAppearance } from '../../appearance-client';
import { useT } from '../../i18n';
import { useWorkspace } from '../../workspace';
import { EditorArea } from '../editor/EditorArea';
import { FileTree } from '../sidebar/FileTree';
import { GitPanel } from '../sidebar/GitPanel';
import { KnowledgePanel } from '../sidebar/KnowledgePanel';
import { McpPanel } from '../sidebar/McpPanel';
import { SearchPanel } from '../sidebar/SearchPanel';
import { SessionsPanel } from '../sidebar/SessionsPanel';
import { SkillsPanel } from '../sidebar/SkillsPanel';

/** Panel boczny w oderwanym oknie — bez railu, na pełnej wysokości. */
function PanelBody({ panel }: { panel: string }): ReactElement {
  const t = useT();
  const { root } = useWorkspace();
  if (panel === 'files') {
    return <FileTree key={root} />;
  }
  if (panel === 'search') {
    return (
      <>
        <h2 className="view-title">{t('sidebar.view.search')}</h2>
        <SearchPanel />
      </>
    );
  }
  if (panel === 'git') {
    return (
      <>
        <h2 className="view-title">{t('sidebar.view.git')}</h2>
        <GitPanel key={root} />
      </>
    );
  }
  if (panel === 'sessions') {
    return (
      <>
        <h2 className="view-title">{t('sidebar.view.sessions')}</h2>
        <SessionsPanel key={root} />
      </>
    );
  }
  if (panel === 'knowledge') {
    return (
      <>
        <h2 className="view-title">{t('sidebar.view.knowledge')}</h2>
        <KnowledgePanel key={root} />
      </>
    );
  }
  if (panel === 'skills') {
    return (
      <>
        <h2 className="view-title">{t('sidebar.view.skills')}</h2>
        <SkillsPanel key={root} />
      </>
    );
  }
  return (
    <>
      <h2 className="view-title">{t('sidebar.view.mcp')}</h2>
      <McpPanel key={root} />
    </>
  );
}

/**
 * Zawartość okna oderwanego (M62): panel boczny albo karta edytora,
 * wyciągnięte z okna głównego przeciągnięciem poza jego obszar.
 */
export function DetachedPanel({ target }: { target: DetachedTarget }): ReactElement {
  const { openFile, openKnowledgeGraph } = useWorkspace();

  useEffect(() => {
    void window.api.getAppearance().then(applyAppearance);
  }, []);

  // Karta edytora: otwieramy ją w tym oknie po starcie.
  useEffect(() => {
    if (target.kind !== 'view') {
      return;
    }
    if (target.target.startsWith('vn3o://')) {
      openKnowledgeGraph();
    } else {
      openFile(target.target);
    }
  }, [target, openFile, openKnowledgeGraph]);

  if (target.kind === 'view') {
    return (
      <div className="shell detached-shell" data-testid="detached-view">
        <div className="center detached-center">
          <EditorArea />
        </div>
      </div>
    );
  }

  return (
    <div className="shell detached-shell" data-testid="detached-panel">
      <div className="detached-panel-body view-panel pad scroll">
        <PanelBody panel={target.target} />
      </div>
    </div>
  );
}
