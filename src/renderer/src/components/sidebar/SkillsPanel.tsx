import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react';
import { commandHint, commandInvocation } from '../../../../shared/claude/commands';
import type {
  AgentCreateInput,
  AgentEntry,
  RuleCreateInput,
  SkillCreateInput,
  SkillEntry,
  SkillsSnapshot,
} from '../../../../shared/ipc';
import { useDocks } from '../../docks';
import { tf, tp, useT } from '../../i18n';
import { useDialogs } from '../../ui-dialogs';
import { useWorkspace } from '../../workspace';
import { AgentCreateDialog } from '../dialogs/AgentCreateDialog';
import { RuleCreateDialog } from '../dialogs/RuleCreateDialog';
import { SkillCreateDialog } from '../dialogs/SkillCreateDialog';

interface RowToggle {
  checked: boolean;
  label: string;
  testid: string;
  /** Blokada: deny spoza settings.local.json — przełącznik go nie cofnie. */
  locked?: boolean;
  onChange(next: boolean): void;
}

interface RowProps {
  name: string;
  description?: string;
  path: string;
  badges?: Array<{ text: string; title?: string }>;
  /** Wyszarzenie wiersza skilla wyłączonego przez skillOverrides. */
  dimmed?: boolean;
  /** Delikatnie zielone tło włączonego skilla/agenta. */
  tinted?: boolean;
  toggle?: RowToggle;
  onOpen(path: string): void;
  onMetaClick?(): void;
}

function EntryRow({
  name,
  description,
  path,
  badges,
  dimmed,
  tinted,
  toggle,
  onOpen,
  onMetaClick,
}: RowProps): ReactElement {
  const handleClick = (event: MouseEvent): void => {
    if (event.metaKey && onMetaClick) {
      onMetaClick();
    } else {
      onOpen(path);
    }
  };
  return (
    <div className={`skill-item${dimmed ? ' skill-item-off' : ''}${tinted ? ' skill-item-on' : ''}`}>
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
      {toggle && (
        <label className="skill-toggle" title={toggle.label}>
          <input
            type="checkbox"
            role="switch"
            aria-label={toggle.label}
            data-testid={toggle.testid}
            checked={toggle.checked}
            disabled={toggle.locked}
            onChange={(event) => toggle.onChange(event.target.checked)}
          />
        </label>
      )}
    </div>
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
  const t = useT();
  const { root, openFile } = useWorkspace();
  const { insertToActiveClaude } = useDocks();
  const { notify } = useDialogs();
  const [snapshot, setSnapshot] = useState<SkillsSnapshot | null>(null);
  const [creating, setCreating] = useState<'skill' | 'agent' | 'rule' | null>(null);
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
      notify(t('common.noClaudeSession'), 'error');
    }
  };

  const toggleSkill = (skill: SkillEntry, next: boolean): void => {
    void window.api.setSkillEnabled(rootRef.current, skill.name, next).then((result) => {
      if (!result.ok) {
        notify(
          t(result.error === 'settings-unreadable' ? 'skills.toggleUnreadable' : 'skills.toggleFailed'),
          'error',
        );
      }
      refresh();
    });
  };

  const toggleAgent = (agent: AgentEntry, next: boolean): void => {
    void window.api.setAgentEnabled(rootRef.current, agent.name, next).then((result) => {
      if (!result.ok) {
        notify(
          t(result.error === 'settings-unreadable' ? 'skills.toggleUnreadable' : 'skills.toggleFailed'),
          'error',
        );
      }
      refresh();
    });
  };

  /** Wspólne domknięcie kreatorów: toast, otwarcie pliku, odświeżenie listy. */
  const finishCreate = (
    result: Awaited<ReturnType<typeof window.api.createSkill>>,
    createdMessage: string,
  ): 'invalid-name' | 'exists' | 'write-failed' | null => {
    if (!result.ok) {
      return result.error;
    }
    setCreating(null);
    notify(createdMessage, 'success');
    openFile(result.path);
    refresh();
    return null;
  };

  const createSkill = async (
    input: SkillCreateInput,
  ): Promise<'invalid-name' | 'exists' | 'write-failed' | null> =>
    finishCreate(
      await window.api.createSkill(rootRef.current, input),
      tf('skills.create.created', { name: input.name }),
    );

  const createAgent = async (
    input: AgentCreateInput,
  ): Promise<'invalid-name' | 'exists' | 'write-failed' | null> =>
    finishCreate(
      await window.api.createAgent(rootRef.current, input),
      tf('agents.create.created', { name: input.name }),
    );

  const createRule = async (
    input: RuleCreateInput,
  ): Promise<'invalid-name' | 'exists' | 'write-failed' | null> =>
    finishCreate(
      await window.api.createRule(rootRef.current, input),
      tf('rules.create.created', { name: input.name }),
    );

  if (!snapshot) {
    return <p className="placeholder">{t('common.loading')}</p>;
  }

  const empty = <p className="skill-empty placeholder">{t('skills.emptyGroup')}</p>;

  const skillRow = (skill: SkillEntry): ReactElement => (
    <EntryRow
      key={skill.path}
      name={skill.name}
      description={skill.description}
      path={skill.path}
      dimmed={!skill.enabled}
      tinted={skill.enabled}
      badges={[
        ...(skill.override === 'name-only' || skill.override === 'user-invocable-only'
          ? [{ text: skill.override, title: `skillOverrides: ${skill.override}` }]
          : []),
        ...(skill.manual ? [{ text: 'manual', title: 'disable-model-invocation' }] : []),
      ]}
      toggle={{
        checked: skill.enabled,
        label: t('skills.toggleTitle'),
        testid: `skill-toggle-${skill.name}`,
        onChange: (next) => toggleSkill(skill, next),
      }}
      onOpen={openFile}
      onMetaClick={() => insertSlash(skill.name)}
    />
  );

  return (
    <div className="skills-panel" data-testid="skills-panel">
      <div className="skills-toolbar">
        <button
          type="button"
          className="bar-btn"
          data-testid="skills-new"
          title={t('skills.create.hint')}
          onClick={() => setCreating('skill')}
        >
          {t('skills.new')}
        </button>
        <button
          type="button"
          className="bar-btn"
          data-testid="agents-new"
          title={t('agents.create.hint')}
          onClick={() => setCreating('agent')}
        >
          {t('skills.newAgent')}
        </button>
        <button
          type="button"
          className="bar-btn"
          data-testid="rules-new"
          title={t('rules.create.hint')}
          onClick={() => setCreating('rule')}
        >
          {t('skills.newRule')}
        </button>
      </div>
      <Group title={t('skills.project')} count={snapshot.projectSkills.length}>
        {snapshot.projectSkills.length === 0 ? empty : snapshot.projectSkills.map(skillRow)}
      </Group>
      <Group title={t('skills.personal')} count={snapshot.personalSkills.length}>
        {snapshot.personalSkills.length === 0 ? empty : snapshot.personalSkills.map(skillRow)}
      </Group>
      <Group title={t('skills.agents')} count={snapshot.agents.length}>
        {snapshot.agents.length === 0
          ? empty
          : snapshot.agents.map((agent) => (
              <EntryRow
                key={agent.path}
                name={agent.name}
                description={agent.description}
                path={agent.path}
                dimmed={!agent.enabled}
                tinted={agent.enabled}
                badges={agent.model ? [{ text: agent.model, title: 'model' }] : []}
                toggle={{
                  checked: agent.enabled,
                  locked: agent.deniedElsewhere,
                  label: agent.deniedElsewhere
                    ? t('skills.agentLocked')
                    : t('skills.agentToggleTitle'),
                  testid: `agent-toggle-${agent.name}`,
                  onChange: (next) => toggleAgent(agent, next),
                }}
                onOpen={openFile}
              />
            ))}
      </Group>
      <Group title={t('skills.rules')} count={snapshot.rules.length}>
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
      <Group title={t('skills.commands')} count={snapshot.commands.length}>
        {snapshot.commands.length === 0
          ? empty
          : snapshot.commands.map((command) => {
              const hint = commandHint(command.argumentHint);
              return (
                <EntryRow
                  key={command.path}
                  name={commandInvocation(command.name)}
                  description={command.description}
                  path={command.path}
                  badges={[
                    ...(hint ? [{ text: hint, title: 'argument-hint' }] : []),
                    ...(command.scope === 'personal'
                      ? [{ text: t('skills.commandPersonal'), title: '~/.claude/commands' }]
                      : []),
                  ]}
                  onOpen={openFile}
                  onMetaClick={() => insertSlash(command.name)}
                />
              );
            })}
      </Group>
      <div className="claude-md-section">
        <h3 className="view-title">{t('skills.claudeMd')}</h3>
        <p className="skill-hint placeholder">{t('skills.claudeMdHint')}</p>
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
              <span className="badge">{tp('unit.lines', entry.lines)}</span>
            </span>
          </button>
        ))}
      </div>
      {creating === 'skill' && (
        <SkillCreateDialog onClose={() => setCreating(null)} onSubmit={createSkill} />
      )}
      {creating === 'agent' && (
        <AgentCreateDialog onClose={() => setCreating(null)} onSubmit={createAgent} />
      )}
      {creating === 'rule' && (
        <RuleCreateDialog onClose={() => setCreating(null)} onSubmit={createRule} />
      )}
    </div>
  );
}
