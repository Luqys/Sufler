import { describe, expect, it } from 'vitest';
import {
  defaultShell,
  executableCandidates,
  pathDelimiter,
  pathDirs,
  shellTitle,
  spawnPlanFor,
  windowsExtensions,
} from '../src/shared/exec-path';

const WIN_ENV = {
  Path: 'C:\\Windows\\system32;C:\\Users\\kto\\AppData\\Roaming\\npm',
  PATHEXT: '.COM;.EXE;.BAT;.CMD',
  COMSPEC: 'C:\\Windows\\system32\\cmd.exe',
};

const POSIX_ENV = { PATH: '/usr/local/bin:/usr/bin', SHELL: '/bin/zsh' };

describe('pathDirs', () => {
  it('rozdziela PATH właściwym separatorem systemu', () => {
    expect(pathDelimiter('win32')).toBe(';');
    expect(pathDelimiter('posix')).toBe(':');
    expect(pathDirs(POSIX_ENV.PATH, 'posix')).toEqual(['/usr/local/bin', '/usr/bin']);
    expect(pathDirs(WIN_ENV.Path, 'win32')).toEqual([
      'C:\\Windows\\system32',
      'C:\\Users\\kto\\AppData\\Roaming\\npm',
    ]);
  });

  it('pomija puste wpisy i zdejmuje cudzysłowy (Windows je dopuszcza)', () => {
    expect(pathDirs('"C:\\bin";;C:\\inne', 'win32')).toEqual(['C:\\bin', 'C:\\inne']);
    expect(pathDirs(undefined, 'posix')).toEqual([]);
  });
});

describe('windowsExtensions', () => {
  it('stawia .exe przed .cmd — plik wykonywalny uruchamia się wprost', () => {
    // .ps1 dochodzi, bo shim npm-a taki tworzy, a PATHEXT go zwykle nie wymienia.
    expect(windowsExtensions('.COM;.EXE;.BAT;.CMD')).toEqual([
      '.exe',
      '.cmd',
      '.bat',
      '.com',
      '.ps1',
    ]);
  });

  it('rozszerzenia z PATHEXT, których nie umiemy uruchomić, są pomijane', () => {
    expect(windowsExtensions('.EXE;.VBS;.JS;.CMD')).toEqual(['.exe', '.cmd', '.ps1']);
  });

  it('brak PATHEXT daje sensowny zestaw domyślny', () => {
    expect(windowsExtensions(undefined)).toEqual(['.exe', '.cmd', '.bat', '.com', '.ps1']);
  });
});

describe('executableCandidates', () => {
  it('Windows: każdy katalog PATH razy każde rozszerzenie', () => {
    const candidates = executableCandidates('claude', WIN_ENV, 'win32');
    expect(candidates).toContain('C:\\Users\\kto\\AppData\\Roaming\\npm\\claude.cmd');
    expect(candidates).toContain('C:\\Users\\kto\\AppData\\Roaming\\npm\\claude.exe');
    // .exe sprawdzane przed .cmd w obrębie katalogu.
    expect(candidates.indexOf('C:\\Windows\\system32\\claude.exe')).toBeLessThan(
      candidates.indexOf('C:\\Windows\\system32\\claude.cmd'),
    );
  });

  it('POSIX: bez rozszerzeń, sama lista katalogów', () => {
    expect(executableCandidates('claude', POSIX_ENV, 'posix')).toEqual([
      '/usr/local/bin/claude',
      '/usr/bin/claude',
    ]);
  });

  it('komenda ze ścieżką nie jest szukana w PATH', () => {
    expect(executableCandidates('/opt/claude/bin/claude', POSIX_ENV, 'posix')).toEqual([
      '/opt/claude/bin/claude',
    ]);
    expect(executableCandidates('C:\\narzedzia\\claude.cmd', WIN_ENV, 'win32')).toEqual([
      'C:\\narzedzia\\claude.cmd',
    ]);
  });

  it('nazwa z rozszerzeniem nie dostaje drugiego', () => {
    expect(executableCandidates('claude.cmd', WIN_ENV, 'win32')).toEqual([
      'C:\\Windows\\system32\\claude.cmd',
      'C:\\Users\\kto\\AppData\\Roaming\\npm\\claude.cmd',
    ]);
  });
});

describe('defaultShell', () => {
  it('POSIX bierze SHELL, Windows COMSPEC', () => {
    expect(defaultShell(POSIX_ENV, 'posix')).toBe('/bin/zsh');
    expect(defaultShell(WIN_ENV, 'win32')).toBe('C:\\Windows\\system32\\cmd.exe');
  });

  it('brak zmiennej daje rozsądną wartość dla systemu', () => {
    expect(defaultShell({}, 'posix')).toBe('/bin/zsh');
    expect(defaultShell({}, 'win32')).toBe('cmd.exe');
  });
});

describe('shellTitle', () => {
  it('tytuł karty to nazwa powłoki bez ścieżki i rozszerzenia', () => {
    expect(shellTitle('/bin/zsh')).toBe('zsh');
    expect(shellTitle('C:\\Windows\\system32\\cmd.exe')).toBe('cmd');
    expect(shellTitle('powershell.exe')).toBe('powershell');
  });
});

describe('spawnPlanFor', () => {
  it('plik wsadowy Windowsa idzie przez cmd.exe /d /s /c — tego wymaga CreateProcess', () => {
    const plan = spawnPlanFor(
      'C:\\Users\\kto\\AppData\\Roaming\\npm\\claude.cmd',
      ['--resume', 'abc'],
      WIN_ENV,
      'win32',
    );
    expect(plan.command).toBe('C:\\Windows\\system32\\cmd.exe');
    expect(plan.args).toEqual([
      '/d',
      '/s',
      '/c',
      'C:\\Users\\kto\\AppData\\Roaming\\npm\\claude.cmd',
      '--resume',
      'abc',
    ]);
  });

  it('.exe uruchamia się wprost, z nietkniętymi argumentami', () => {
    const plan = spawnPlanFor('C:\\bin\\claude.exe', ['/login'], WIN_ENV, 'win32');
    expect(plan).toEqual({ command: 'C:\\bin\\claude.exe', args: ['/login'] });
  });

  it('.ps1 przez powershell z pominięciem profilu', () => {
    const plan = spawnPlanFor('C:\\bin\\claude.ps1', [], WIN_ENV, 'win32');
    expect(plan.command).toBe('powershell.exe');
    expect(plan.args).toContain('-File');
    expect(plan.args).toContain('C:\\bin\\claude.ps1');
  });

  it('POSIX zostawia komendę i argumenty bez zmian', () => {
    const plan = spawnPlanFor('/usr/local/bin/claude', ['/login'], POSIX_ENV, 'posix');
    expect(plan).toEqual({ command: '/usr/local/bin/claude', args: ['/login'] });
  });
});
