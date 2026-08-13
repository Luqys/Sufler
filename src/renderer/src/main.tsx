import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DetachedApp } from './DetachedApp';
import { DetachedTerminal } from './components/dock/DetachedTerminal';
import { parseDetachedTarget } from '../../shared/docks/detached';
import { installWheelScroll } from './wheel';
import './styles.css';

// Jednolite tempo przewijania w każdym oknie (główne, odczepione panele/terminale).
installWheelScroll();

const root = document.getElementById('root');
const isDetachedTerminal =
  new URLSearchParams(location.search).get('window') === 'terminal';
const detachedTarget = parseDetachedTarget(location.search);

if (root) {
  createRoot(root).render(
    <StrictMode>
      {isDetachedTerminal ? (
        <DetachedTerminal />
      ) : detachedTarget ? (
        <DetachedApp target={detachedTarget} />
      ) : (
        <App />
      )}
    </StrictMode>,
  );
}
