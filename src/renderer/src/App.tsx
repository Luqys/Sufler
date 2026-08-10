import { useEffect, useState, type ReactElement } from 'react';
import type { LayoutState } from '../../shared/layout';
import { Workbench } from './components/Workbench';
import { WorkspaceProvider } from './workspace';

export function App(): ReactElement | null {
  const [initialLayout, setInitialLayout] = useState<LayoutState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api.getLayout().then((layout) => {
      if (!cancelled) {
        setInitialLayout(layout);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!initialLayout) {
    return null;
  }
  return (
    <WorkspaceProvider>
      <Workbench initialLayout={initialLayout} />
    </WorkspaceProvider>
  );
}
