import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './i18n/index.js';
import './styles/hero-journey.css';
import { warmNavigationTo } from './navigation/pagePrefetch.js';

// The reviewed 15s C+ journey is now the homepage's local published design.
// It does not affect Works, the player, or mobile section spacing.
if (location.pathname.endsWith('/index.html') || location.pathname.endsWith('/')) {
  document.documentElement.dataset.heroExperience = 'cinematic';
  await import('./utils/heroScrollRecovery.js');
  const { activateImmersive } = await import('./utils/heroImmersivePreview.js');
  activateImmersive();
  const { initHeroScrollGuide } = await import('./utils/heroScrollGuide.js');
  initHeroScrollGuide();
}

await (window.__gsapReady || Promise.resolve()).catch(() => undefined);

createRoot(document.getElementById('react-root')).render(
  <StrictMode><App /></StrictMode>
);

// 让静态 HTML 的 hash 定位等待 React 模块挂载完成，避免动态内容把目标章节推离固定头部。
requestAnimationFrame(() => window.dispatchEvent(new Event('portfolio:react-ready')));

// Do not compete with Hero for bandwidth: warm the work-library document only
// once visitors approach the featured archive, or express navigation intent.
warmNavigationTo('./works.html', { observe: document.getElementById('projects-react-root') });
