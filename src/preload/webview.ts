import { ipcRenderer } from 'electron';

/**
 * Preload gościa <webview> podglądu przeglądarki: tryb wskazywania elementu.
 * Host wysyła 'vn3o:start-pick' / 'vn3o:stop-pick'; wybór wraca przez
 * sendToHost('vn3o:picked', info) albo 'vn3o:pick-cancelled'.
 */

interface PickedElementInfo {
  selector: string;
  tag: string;
  id: string;
  classes: string[];
  text: string;
  url: string;
}

let active = false;
let overlay: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;

function ensureOverlay(): void {
  if (overlay) {
    return;
  }
  overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #d97757;' +
    'background:rgba(217,119,87,0.12);border-radius:3px;transition:all 40ms linear;display:none;';
  label = document.createElement('div');
  label.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;background:#d97757;color:#fff;' +
    "font:11px -apple-system,sans-serif;padding:2px 6px;border-radius:4px;display:none;";
  document.documentElement.append(overlay, label);
}

function buildSelector(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.documentElement && parts.length < 5) {
    let part = node.tagName.toLowerCase();
    for (const cls of [...node.classList].slice(0, 2)) {
      part += `.${CSS.escape(cls)}`;
    }
    const parent = node.parentElement;
    if (parent) {
      const sameTag = [...parent.children].filter((child) => child.tagName === node?.tagName);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    if (document.querySelectorAll(parts.join(' > ')).length === 1) {
      return parts.join(' > ');
    }
    node = node.parentElement;
  }
  return parts.join(' > ');
}

function onMouseMove(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (!target || !overlay || !label) {
    return;
  }
  const rect = target.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  label.style.display = 'block';
  label.style.left = `${rect.left}px`;
  label.style.top = `${Math.max(2, rect.top - 20)}px`;
  label.textContent = target.tagName.toLowerCase();
}

function onClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (!target) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const info: PickedElementInfo = {
    selector: buildSelector(target),
    tag: target.tagName.toLowerCase(),
    id: target.id,
    classes: [...target.classList],
    text: (target.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80),
    url: location.href,
  };
  stopPicking();
  ipcRenderer.sendToHost('vn3o:picked', info);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    stopPicking();
    ipcRenderer.sendToHost('vn3o:pick-cancelled');
  }
}

function startPicking(): void {
  if (active) {
    return;
  }
  active = true;
  ensureOverlay();
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.documentElement.style.cursor = 'crosshair';
}

function stopPicking(): void {
  if (!active) {
    return;
  }
  active = false;
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.documentElement.style.cursor = '';
  if (overlay) {
    overlay.style.display = 'none';
  }
  if (label) {
    label.style.display = 'none';
  }
}

ipcRenderer.on('vn3o:start-pick', startPicking);
ipcRenderer.on('vn3o:stop-pick', () => stopPicking());
