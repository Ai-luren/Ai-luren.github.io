import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './i18n/index.js';

await (window.__gsapReady || Promise.resolve()).catch(() => undefined);

createRoot(document.getElementById('react-root')).render(
  <StrictMode><App /></StrictMode>
);
