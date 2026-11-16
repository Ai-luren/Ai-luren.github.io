import { useT } from '../i18n/index.js';
import './HeroActions.css';

// Reuse the same anchored navigation contract as the mobile menu, including
// scroll offset, nav active state and reduced-motion handling. Assigning
// window.location.hash directly invokes native anchor scrolling instead.
const navigateToSection = (section) => {
  const link = document.querySelector(`#mobile-primary-nav a[href="#${section}"]`);
  if (link) link.click();
  else window.location.hash = section;
};

export default function HeroActions() {
  const t = useT();

  return (
    <>
      <button
        className="hero-primary"
        type="button"
        onClick={() => navigateToSection('projects')}
      >
        {t('查看作品', 'View Work')}
      </button>
      <button
        className="hero-secondary"
        type="button"
        onClick={() => navigateToSection('contact')}
      >
        {t('合作联系', 'Get in Touch')}
      </button>
    </>
  );
}
