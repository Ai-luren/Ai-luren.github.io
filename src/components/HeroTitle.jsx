import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import TextType from './TextType.jsx';
import './HeroTitle.css';

export default function HeroTitle() {
  const titleRef = useRef(null);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return undefined;

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
      <span className="hero-title__prefix">AI创意</span>
      <TextType
        as="span"
        className="hero-title__rotating"
        text={['图像设计', '视频设计', '氛围编程']}
        typingSpeed={125}
        deletingSpeed={80}
        pauseDuration={2600}
        initialDelay={260}
        showCursor
        cursorCharacter="_"
      />
    </h1>
  );
}
