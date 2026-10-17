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
        {t('查看作品', 'View Work')}
      </button>
      <button
        className="hero-secondary"
        type="button"
        onClick={() => { window.location.hash = 'contact'; }}
      >
        {t('合作联系', 'Get in Touch')}
      </button>
    </>
  );
}
