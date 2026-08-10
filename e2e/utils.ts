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
  return dir;
}

export function makeConfigHome(): string {
  return mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
}

export function launchApp(configHome: string, projectRoot?: string): Promise<ElectronApplication> {
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
  return electron.launch({ args: ['.'], env });
}
