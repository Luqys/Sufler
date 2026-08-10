import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DetachedTerminal } from './components/DetachedTerminal';
import './styles.css';

const root = document.getElementById('root');
const isDetachedTerminal =
  new URLSearchParams(location.search).get('window') === 'terminal';

if (root) {
  createRoot(root).render(
    <StrictMode>{isDetachedTerminal ? <DetachedTerminal /> : <App />}</StrictMode>,
  );
}
