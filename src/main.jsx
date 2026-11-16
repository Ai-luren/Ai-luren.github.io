import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './i18n/index.js';
import './styles/hero-journey.css';
import { warmNavigationTo } from './navigation/pagePrefetch.js';

// Render first; optional Hero enhancements must never gate the headline,
// navigation, featured cards or expertise portals on a cold page load.
const isHome = location.pathname.endsWith('/index.html') || location.pathname.endsWith('/');
if (isHome) document.documentElement.dataset.heroExperience = 'cinematic';
const heroEnhancements = isHome
  ? Promise.all([
    import('./utils/heroScrollRecovery.js'),
    import('./utils/heroImmersivePreview.js'),
    import('./utils/heroScrollGuide.js'),
  ])
  : null;

createRoot(document.getElementById('react-root')).render(
  <StrictMode><App /></StrictMode>
);

// Section anchors wait for React and are corrected again after optional travel
// spacers mount; first paint is not delayed for GSAP or dynamic import chains.
requestAnimationFrame(() => window.dispatchEvent(new Event('portfolio:react-ready')));
heroEnhancements?.then(([, journey, guide]) => {
  journey.activateImmersive();
  guide.initHeroScrollGuide();
  requestAnimationFrame(() => window.dispatchEvent(new Event('portfolio:react-ready')));
}).catch(error => {
  console.warn('[portfolio] Optional Hero enhancement unavailable:', error);
});

// Warm the work-library document only near Featured or on explicit intent.
warmNavigationTo('./works.html', { observe: document.getElementById('projects-react-root') });
