import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import SimulatedArchive from './SimulatedArchive';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {window.location.pathname === '/simulated' ? (
      <SimulatedArchive />
    ) : window.location.pathname === '/official' ? (
      <SimulatedArchive environment="official" />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
