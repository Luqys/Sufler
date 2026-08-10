/**
 * Rozpoznawanie plików graficznych po rozszerzeniu — takie pliki dostają
 * podgląd obrazka zamiast edytora tekstu. Czysta logika — testowana.
 */

const IMAGE_MIME: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

/** MIME obrazka na podstawie rozszerzenia; null, gdy to nie plik graficzny. */
export function imageMime(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot < 0) {
    return null;
  }
  return IMAGE_MIME[path.slice(dot + 1).toLowerCase()] ?? null;
}

export function isImagePath(path: string): boolean {
  return imageMime(path) !== null;
}
