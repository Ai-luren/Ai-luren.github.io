import { useT } from '../i18n/index.js';
import './HeroActions.css';

export default function HeroActions() {
  const t = useT();

  return (
    <>
      <button
        className="hero-primary"
        type="button"
        onClick={() => { window.location.hash = 'projects'; }}
      >
        {t('查看创作档案', 'View Selected Work')}
      </button>
      <button
        className="hero-secondary"
        type="button"
        onClick={() => { window.location.hash = 'profile'; }}
      >
        {t('浏览工作经历', 'Explore Work History')}
      </button>
    </>
  );
}
