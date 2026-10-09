import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { EscrowProvider } from './store/EscrowContext';
import { createGateway } from './lib/createGateway';
import './index.css';

// Gateway is selected from the environment, never hardcoded here.
const gateway = createGateway(import.meta.env.VITE_CORE_GATEWAY ?? 'mock');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <EscrowProvider gateway={gateway}>
        <App />
      </EscrowProvider>
    </HashRouter>
  </StrictMode>,
);
