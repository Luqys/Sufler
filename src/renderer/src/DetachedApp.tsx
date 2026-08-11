import { type ReactElement } from 'react';
import type { DetachedTarget } from '../../shared/detached';
import { DetachedPanel } from './components/DetachedPanel';
import { DocksProvider } from './docks';
import { DialogProvider } from './ui-dialogs';
import { WorkspaceProvider } from './workspace';

/**
 * Okno oderwane (M62) dostaje te same konteksty co okno główne — panele
 * i karty działają wtedy bez żadnych wyjątków w kodzie komponentów.
 */
export function DetachedApp({ target }: { target: DetachedTarget }): ReactElement {
  return (
    <DialogProvider>
      <WorkspaceProvider>
        <DocksProvider>
          <DetachedPanel target={target} />
        </DocksProvider>
      </WorkspaceProvider>
    </DialogProvider>
  );
}
