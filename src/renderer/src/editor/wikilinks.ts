/**
 * Wikilinki `[[nazwa]]` jako klikalne linki Monaco (M36): provider znajduje
 * wystąpienia (shared/wikilinks), rozwiązuje nazwy przez indeks vaulta w main
 * i zwraca linki z pseudo-URL `vn3o-note:<ścieżka>`; opener otwiera cel
 * w edytorze. Cmd+klik — standardowy gest „idź do linku" Monaco.
 */
import { monaco } from '../monaco-setup';
import { findWikilinks } from '../../../shared/knowledge/wikilinks';

const NOTE_SCHEME = 'vn3o-note';

type OpenNote = (path: string) => void;
let openNote: OpenNote = () => {};
let registered = false;

/** Podpięcie akcji otwierania (workspace.openFile) — wołane przy starcie UI. */
export function initWikilinks(open: OpenNote): void {
  openNote = open;
  if (registered) {
    return;
  }
  registered = true;

  monaco.languages.registerLinkProvider('markdown', {
    async provideLinks(model) {
      const occurrences = findWikilinks(model.getValue());
      if (occurrences.length === 0) {
        return { links: [] };
      }
      const resolved = await window.api.resolveNoteLinks([
        ...new Set(occurrences.map((entry) => entry.name)),
      ]);
      return {
        links: occurrences.flatMap((entry) => {
          const target = resolved[entry.name];
          if (!target) {
            return [];
          }
          return [
            {
              range: new monaco.Range(
                entry.line,
                entry.startColumn,
                entry.line,
                entry.endColumn,
              ),
              // Ścieżka absolutna zaczyna się od '/' — bez dublowania slasha,
              // żeby round-trip URI nie zrobił z niej authority.
              url: monaco.Uri.from({ scheme: NOTE_SCHEME, path: target }),
            },
          ];
        }),
      };
    },
  });

  monaco.editor.registerLinkOpener({
    open(resource) {
      if (resource.scheme !== NOTE_SCHEME) {
        return false;
      }
      openNote(resource.path);
      return true;
    },
  });
}
