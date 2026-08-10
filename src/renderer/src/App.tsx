import { useEffect, useState, type ReactElement } from 'react';
import type { LayoutState } from '../../shared/layout';
import { applyAppearance } from './appearance-client';
import { Workbench } from './components/Workbench';
import { DocksProvider } from './docks';
import { DialogProvider } from './ui-dialogs';
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
    void window.api.getAppearance().then((appearance) => {
      if (!cancelled) {
        applyAppearance(appearance);
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
    <DialogProvider>
      <WorkspaceProvider>
        <DocksProvider>
          <Workbench initialLayout={initialLayout} />
        </DocksProvider>
      </WorkspaceProvider>
    </DialogProvider>
  );
}
