import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/app.css';
import { App } from './App';
import { installLockdown } from './lib/lockdown';

// dev convenience: `await (await __seed()).loadDemoData()` in the console
if (import.meta.env.DEV) (window as unknown as { __seed: () => Promise<unknown> }).__seed = () => import('./db/seed');

installLockdown();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
