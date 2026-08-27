import SpecularButton from './SpecularButton.jsx';
import { useT } from '../i18n/index.js';
import './HeroActions.css';

export default function HeroActions() {
  const t = useT();

  return (
    <>
      <SpecularButton
        className="hero-primary"
        size="md"
        radius={999}
        tint="#2f80ed"
        tintOpacity={1}
        blur={0}
        textColor="#fff"
        lineColor="#fff"
        baseColor="#2f80ed"
        intensity={1}
        shineSize={10}
        shineFade={40}
        thickness={1}
        speed={0.35}
        followMouse
        proximity={250}
        onClick={() => { window.location.hash = 'projects'; }}
      >
        {t('查看创作档案', 'View Selected Work')}
      </SpecularButton>
      <SpecularButton
        size="md"
        radius={999}
        tint="#08121c"
        tintOpacity={0.46}
        blur={12}
        textColor="#f0f4f6"
        lineColor="#fff"
        baseColor="#8ca4b8"
        intensity={1}
        shineSize={10}
        shineFade={40}
        thickness={1}
        speed={0.35}
        followMouse
        proximity={250}
        onClick={() => { window.location.hash = 'profile'; }}
      >
        {t('浏览工作经历', 'Explore Work History')}
      </SpecularButton>
    </>
  );
}
