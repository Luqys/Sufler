import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication } from 'playwright';

/** Projekt-fixture: repo git z .gitignore, kilkoma plikami i katalogiem node_modules. */
export function makeFixtureProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-proj-'));
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n*.log\n');
  writeFileSync(join(dir, 'README.md'), '# Projekt testowy\n');
  writeFileSync(join(dir, 'debug.log'), 'ukryty\n');
  mkdirSync(join(dir, 'src'));
  writeFileSync(
    join(dir, 'src', 'app.ts'),
    "export const answer = 42;\nconsole.log('witaj', answer);\n",
  );
  mkdirSync(join(dir, 'node_modules', 'fake-pkg'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'fake-pkg', 'index.js'), 'module.exports = 1;\n');
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  const gitEnv = 'git -c user.email=e2e@vn3o.test -c user.name=e2e';
  execSync(`${gitEnv} add -A`, { cwd: dir, stdio: 'ignore' });
  execSync(`${gitEnv} commit -q -m init`, { cwd: dir, stdio: 'ignore' });
  return dir;
}

export function makeConfigHome(): string {
  return mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
}

export function launchApp(
  configHome: string,
  projectRoot?: string,
  extraEnv?: Record<string, string>,
): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env['XDG_CONFIG_HOME'] = configHome;
  if (projectRoot) {
    env['VISUALN3O_ROOT'] = projectRoot;
  } else {
    delete env['VISUALN3O_ROOT'];
  }
  delete env['ELECTRON_RENDERER_URL'];
  // Bez realnych zapytań o limity planu w testach (nadpisywalne przez extraEnv).
  env['VISUALN3O_LIMITS_JSON'] = 'off';
  Object.assign(env, extraEnv);
  return electron.launch({ args: ['.'], env });
}

/**
 * Atrapa binarki `claude` do hermetycznych testów M4: wypisuje sygnały statusu
 * rozpoznawane przez heurystykę i odpowiada na wpisywane linie.
 */
export function makeFakeClaudeBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-bin-'));
  const script = `#!/bin/zsh
if [[ "$1" == "/login" ]]; then
  echo "TRYB-LOGOWANIA: claude /login (atrapa)"
  echo "Otworz przegladarke i wklej kod…"
  while IFS= read -r line; do :; done
  exit 0
fi
echo "── Claude Code (atrapa) ──"
echo "? for shortcuts"
while IFS= read -r line; do
  if [[ "$line" == perm* ]]; then
    echo "Do you want to allow this tool?"
    echo "  1. Yes"
    echo "  2. No"
  else
    echo "esc to interrupt"
    sleep 0.2
    echo "odpowiedz: $line"
    echo "? for shortcuts"
  fi
done
`;
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}
