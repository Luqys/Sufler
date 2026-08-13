/** Ostatni segment ścieżki — nazwa pliku albo katalogu. */
export function baseName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}
