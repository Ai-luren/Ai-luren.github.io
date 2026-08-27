import { useEffect, useRef } from 'react';
import TextType from './TextType.jsx';
import { getGsap } from '../gsap-runtime.js';
import { useLang } from '../i18n/index.js';
import './HeroTitle.css';

const ROTATING_WORDS = {
  zh: ['图像设计', '视频设计', '氛围编程'],
  en: ['Image Design', 'Video Design', 'Vibe Coding'],
};

export default function HeroTitle() {
  const titleRef = useRef(null);
  const lang = useLang();

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return undefined;
    const gsap = getGsap();
    if (!gsap) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const context = gsap.context(() => {
      gsap.fromTo(
        title,
        { autoAlpha: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 18 },
        { autoAlpha: 1, y: 0, duration: reducedMotion ? 0 : 0.65, ease: 'power2.out' },
      );
    }, title);

    return () => context.revert();
  }, []);

  return (
    <h1 ref={titleRef} id="hero-title" className="hero-title">
      <span className="hero-title__prefix">{lang === 'en' ? 'AI Creative' : 'AI创意'}</span>
      <TextType
        key={lang}
        as="span"
        className="hero-title__rotating"
        text={ROTATING_WORDS[lang]}
        typingSpeed={125}
        deletingSpeed={80}
        pauseDuration={2600}
        initialDelay={260}
        showCursor
        cursorCharacter=""
      />
    </h1>
  );
}
