// npm potrafi zgubić bit wykonywalności na prebuiltach node-pty (spawn-helper),
// co objawia się błędem „posix_spawnp failed" przy tworzeniu pty. Uruchamiane z postinstall.
const { chmodSync, existsSync } = require('node:fs');
const { join } = require('node:path');

// Na Windows node-pty nie używa spawn-helpera — skrypt nie ma tam nic do roboty.
if (process.platform !== 'darwin') {
  process.exit(0);
}

const roots = [
  join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds', 'darwin-arm64'),
  join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds', 'darwin-x64'),
];

for (const dir of roots) {
  const helper = join(dir, 'spawn-helper');
  if (existsSync(helper)) {
    chmodSync(helper, 0o755);
    console.log(`fix-node-pty: nadano +x na ${helper}`);
  }
}
