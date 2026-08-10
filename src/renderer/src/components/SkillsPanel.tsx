import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react';
import type { SkillsSnapshot } from '../../../shared/ipc';
import { useDocks } from '../docks';
import { useDialogs } from '../ui-dialogs';
import { useWorkspace } from '../workspace';

function polishLines(n: number): string {
  if (n === 1) {
    return '1 linia';
  }
  const lastTwo = n % 100;
  const last = n % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${n} linie`;
  }
  return `${n} linii`;
}

interface RowProps {
  name: string;
  description?: string;
  path: string;
  badges?: Array<{ text: string; title?: string }>;
  onOpen(path: string): void;
  onMetaClick?(): void;
}

function EntryRow({ name, description, path, badges, onOpen, onMetaClick }: RowProps): ReactElement {
  const handleClick = (event: MouseEvent): void => {
    if (event.metaKey && onMetaClick) {
      onMetaClick();
    } else {
      onOpen(path);
    }
  };
  return (
    <button type="button" className="skill-row" title={path} onClick={handleClick}>
      <span className="skill-line">
        <span className="skill-name">{name}</span>
        {badges?.map((badge) => (
          <span key={badge.text} className="badge" title={badge.title}>
            {badge.text}
          </span>
        ))}
      </span>
      {description && <span className="skill-desc">{description}</span>}
    </button>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactElement[] | ReactElement;
}): ReactElement {
  return (
    <details className="skill-group" open>
      <summary>
        {title} <span className="group-count">{count}</span>
      </summary>
      <div className="skill-group-body">{children}</div>
    </details>
  );
}

export function SkillsPanel(): ReactElement {
  const { root, openFile } = useWorkspace();
  const { insertToActiveClaude } = useDocks();
  const { notify } = useDialogs();
  const [snapshot, setSnapshot] = useState<SkillsSnapshot | null>(null);
  const rootRef = useRef(root);
  rootRef.current = root;
  const subscribed = useRef(false);

  const refresh = useCallback(() => {
    const forRoot = rootRef.current;
    void window.api.getSkills(forRoot).then((data) => {
      if (rootRef.current === forRoot) {
        setSnapshot(data);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
    void window.api.watchSkills(root);
    if (!subscribed.current) {
      subscribed.current = true;
      window.api.onSkillsChanged(refresh);
    }
  }, [refresh, root]);

  const insertSlash = (name: string): void => {
    if (!insertToActiveClaude(`/${name}`)) {
      notify('Brak działającej sesji Claude — otwórz ją przyciskiem ✳ w doku.', 'error');
    }
  };

  if (!snapshot) {
    return <p className="placeholder">Wczytywanie…</p>;
  }

  const empty = <p className="skill-empty placeholder">(brak)</p>;

  return (
    <div className="skills-panel" data-testid="skills-panel">
      <Group title="Skille projektu" count={snapshot.projectSkills.length}>
        {snapshot.projectSkills.length === 0
          ? empty
          : snapshot.projectSkills.map((skill) => (
              <EntryRow
                key={skill.path}
                name={skill.name}
                description={skill.description}
                path={skill.path}
                badges={skill.manual ? [{ text: 'manual', title: 'disable-model-invocation' }] : []}
                onOpen={openFile}
                onMetaClick={() => insertSlash(skill.name)}
              />
            ))}
      </Group>
      <Group title="Skille osobiste" count={snapshot.personalSkills.length}>
        {snapshot.personalSkills.length === 0
          ? empty
          : snapshot.personalSkills.map((skill) => (
              <EntryRow
                key={skill.path}
                name={skill.name}
                description={skill.description}
                path={skill.path}
                badges={skill.manual ? [{ text: 'manual', title: 'disable-model-invocation' }] : []}
                onOpen={openFile}
                onMetaClick={() => insertSlash(skill.name)}
              />
            ))}
      </Group>
      <Group title="Subagenci" count={snapshot.agents.length}>
        {snapshot.agents.length === 0
          ? empty
          : snapshot.agents.map((agent) => (
              <EntryRow
                key={agent.path}
                name={agent.name}
                description={agent.description}
                path={agent.path}
                badges={agent.model ? [{ text: agent.model, title: 'model' }] : []}
                onOpen={openFile}
              />
            ))}
      </Group>
      <Group title="Reguły" count={snapshot.rules.length}>
        {snapshot.rules.length === 0
          ? empty
          : snapshot.rules.map((rule) => (
              <EntryRow
                key={rule.path}
                name={rule.name}
                path={rule.path}
                badges={rule.paths ? [{ text: 'paths', title: rule.paths }] : []}
                onOpen={openFile}
              />
            ))}
      </Group>
      <div className="claude-md-section">
        <h3 className="view-title">Pliki CLAUDE.md</h3>
        <p className="skill-hint placeholder">
          Długi CLAUDE.md to rozdmuchany kontekst — Claude gubi wtedy instrukcje.
        </p>
        {snapshot.claudeMd.length === 0 && empty}
        {snapshot.claudeMd.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className="skill-row claude-md-row"
            title={entry.path}
            onClick={() => openFile(entry.path)}
          >
            <span className="skill-line">
              <span className="skill-name">{entry.label}</span>
              <span className="badge">{polishLines(entry.lines)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
