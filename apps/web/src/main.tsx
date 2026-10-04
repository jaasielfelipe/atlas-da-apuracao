import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Telao from './telao/Telao';
import { environmentFromPath, isTelao } from './environment';
import './styles.css';
const path = window.location.pathname;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isTelao(path) ? (
      <Telao environment={environmentFromPath(path)} />
    ) : (
      <App environment={environmentFromPath(path)} />
    )}
  </React.StrictMode>,
);
