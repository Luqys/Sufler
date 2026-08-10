import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { ReadFileError } from '../../shared/ipc';

export type CurrentFile =
  | { path: string; status: 'loaded'; content: string }
  | { path: string; status: 'error'; message: string };

interface WorkspaceValue {
  root: string;
  currentFile: CurrentFile | null;
  openFile(path: string): void;
  chooseProject(): void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useWorkspace wymaga WorkspaceProvider');
  }
  return value;
}

function describeReadError(error: ReadFileError): string {
  switch (error) {
    case 'too-large':
      return 'Plik jest zbyt duży (limit 10 MB).';
    case 'binary':
      return 'Plik binarny — podgląd niedostępny.';
    case 'unreadable':
      return 'Nie udało się odczytać pliku.';
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }): ReactElement | null {
  const [root, setRoot] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<CurrentFile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api.getProjectRoot().then((projectRoot) => {
      if (!cancelled) {
        setRoot(projectRoot);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openFile = useCallback((path: string) => {
    void window.api.readFile(path).then((result) => {
      if (result.ok) {
        setCurrentFile({ path, status: 'loaded', content: result.content });
      } else {
        setCurrentFile({ path, status: 'error', message: describeReadError(result.error) });
      }
    });
  }, []);

  const chooseProject = useCallback(() => {
    void window.api.openProjectDialog().then((picked) => {
      if (picked) {
        setRoot(picked);
        setCurrentFile(null);
      }
    });
  }, []);

  if (!root) {
    return null;
  }
  return (
    <WorkspaceContext.Provider value={{ root, currentFile, openFile, chooseProject }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
