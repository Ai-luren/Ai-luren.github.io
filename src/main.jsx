import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

await (window.__gsapReady || Promise.resolve()).catch(() => undefined);

createRoot(document.getElementById('react-root')).render(
  <StrictMode><App /></StrictMode>
);
