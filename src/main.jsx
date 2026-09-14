import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './i18n/index.js';

await (window.__gsapReady || Promise.resolve()).catch(() => undefined);

createRoot(document.getElementById('react-root')).render(
  <StrictMode><App /></StrictMode>
);

// 让静态 HTML 的 hash 定位等待 React 模块挂载完成，避免动态内容把目标章节推离固定头部。
requestAnimationFrame(() => window.dispatchEvent(new Event('portfolio:react-ready')));
