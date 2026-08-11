// Podpis ad-hoc całej paczki .app przed złożeniem DMG (hook afterPack).
//
// Bez certyfikatu Developer ID electron-builder pomija podpisywanie i w bundlu
// zostaje wyłącznie linker-signed plik wykonywalny Electrona: `Sealed
// Resources=none`, `codesign --verify` odrzuca paczkę. Taka aplikacja po
// pobraniu (z kwarantanną) nie startuje na Apple Silicon — macOS mówi wprost,
// że jest uszkodzona. Podpis ad-hoc to naprawia.
//
// Ad-hoc nie zastępuje notaryzacji: przy pierwszym uruchomieniu użytkownik i
// tak musi wybrać „Otwórz" z menu kontekstowego (instrukcja jedzie w DMG).
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`adhoc-sign: podpisywanie ${app}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log('adhoc-sign: podpis poprawny');
};
