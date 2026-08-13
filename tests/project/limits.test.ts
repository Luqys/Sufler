import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  capEntries,
  capWatchDirs,
  TREE_ENTRY_LIMIT,
  WATCH_DIR_LIMIT,
} from '../../src/shared/project/limits';
import { readDirListing } from '../../src/main/project/fs-tree';

describe('capEntries', () => {
  it('lista poniżej limitu przechodzi bez zmian i bez ukrytych', () => {
    expect(capEntries([1, 2, 3], 10)).toEqual({ items: [1, 2, 3], hidden: 0 });
  });

  it('powyżej limitu tnie i LICZY resztę, zamiast ją milcząco gubić', () => {
    const { items, hidden } = capEntries(Array.from({ length: 250 }, (_, i) => i), 100);
    expect(items).toHaveLength(100);
    expect(hidden).toBe(150);
    expect(items[99]).toBe(99); // zostaje początek listy, nie losowa próbka
  });

  it('domyślny limit to ten z pomiaru', () => {
    expect(TREE_ENTRY_LIMIT).toBe(2000);
  });
});

describe('capWatchDirs', () => {
  it('zostawia OSTATNIE katalogi — świeżo rozwinięty ma zostać obserwowany', () => {
    const dirs = Array.from({ length: 250 }, (_, i) => `/projekt/kat${i}`);
    const kept = capWatchDirs(dirs, 200);
    expect(kept).toHaveLength(200);
    expect(kept[kept.length - 1]).toBe('/projekt/kat249');
    expect(kept).not.toContain('/projekt/kat0');
  });

  it('znosi duplikaty przed przycięciem', () => {
    expect(capWatchDirs(['/a', '/a', '/b'], 200)).toEqual(['/a', '/b']);
  });

  it('domyślny limit to ten z pomiaru', () => {
    expect(WATCH_DIR_LIMIT).toBe(200);
  });
});

describe('readDirListing na dużym katalogu', () => {
  /** 2500 wpisów — powyżej limitu, poniżej progu bólu przy tworzeniu fixture'u. */
  function makeBigDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'vn3o-duzy-'));
    mkdirSync(join(dir, 'dane'));
    for (let index = 0; index < 2500; index += 1) {
      writeFileSync(join(dir, 'dane', `rekord${String(index).padStart(5, '0')}.json`), '{}');
    }
    return dir;
  }

  it('przycina wpisy i podaje, ilu nie pokazano', async () => {
    const result = await readDirListing(join(makeBigDir(), 'dane'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toHaveLength(TREE_ENTRY_LIMIT);
      expect(result.hidden).toBe(500);
    }
  });

  it('mały katalog nie ma nic ukrytego', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vn3o-maly-'));
    writeFileSync(join(dir, 'a.txt'), 'x');
    writeFileSync(join(dir, 'b.txt'), 'x');
    const result = await readDirListing(dir);
    expect(result.ok && result.hidden).toBe(0);
  });

  it('przycinanie mieści się w budżecie czasu (limit jest po to)', async () => {
    const dir = join(makeBigDir(), 'dane');
    const start = Date.now();
    await readDirListing(dir);
    // Pomiar z M88: 2000 ścieżek w `check-ignore` to ~87 ms; 1,5 s to zapas
    // na wolniejszą maszynę, ale wyłapie powrót do pytania o wszystkie wpisy.
    expect(Date.now() - start).toBeLessThan(1500);
  });
});
