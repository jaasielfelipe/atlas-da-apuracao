import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { environmentFromPath } from './environment';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App environment={environmentFromPath(window.location.pathname)} />
  </React.StrictMode>,
);
