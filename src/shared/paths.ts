export function baseName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

export function relativeTo(root: string, path: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}
