import { useEffect, useLayoutEffect, useRef } from 'react';
import { getGsap } from '../gsap-runtime.js';
import { initCinematicReveals } from '../motion/cinematicReveal.js';
import './AnimatedContent.css';

/*
 * React Bits AnimatedContent — JS/CSS integration adapted to this hybrid app.
 * page="home" drives once-only editorial Featured cards without inserting a div
 * between a grid and its children. Normal usage renders the provided children.
 * The already bundled vendor GSAP is shared by both pages, with no duplicate
 * runtime, and content is never hidden before JavaScript mounts.
 */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const WIPES = {
  up: 'linear-gradient(to top, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  down: 'linear-gradient(to bottom, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  left: 'linear-gradient(to left, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  right: 'linear-gradient(to right, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  center: 'radial-gradient(farthest-corner at 50% 50%, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
};

export default function AnimatedContent({
  children,
  page,
  container,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  blur = 0,
  rotate = 0,
  tilt = 0,
  wipe = 'none',
  threshold = 0.1,
  delay = 0,
  stagger = 0,
  staggerFrom = 'start',
  trigger = 'scroll',
  once = true,
  scrub = false,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = 'power3.in',
  onStart,
  onComplete,
  onDisappearanceComplete,
  className = '',
  style,
  ...props
}) {
  const ref = useRef(null);
  const callbacksRef = useRef({ onStart, onComplete, onDisappearanceComplete });
  callbacksRef.current = { onStart, onComplete, onDisappearanceComplete };

  useIsoLayoutEffect(() => {
    // Headless adaptation: avoid extra wrappers on existing grid and glass cards.
    // The homepage alone uses scroll-driven cinematic depth.
    // All Work is a stable browsing surface and never mounts this motion.
    if (page === 'home') return initCinematicReveals();
    if (page) return undefined;

    const el = ref.current;
    const gsap = getGsap();
    if (!el || !gsap) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = stagger > 0 && el.children.length ? [...el.children] : [el];
    if (reduce) {
      callbacksRef.current.onComplete?.();
      return undefined;
    }

    const axis = direction === 'horizontal' ? 'x' : 'y';
    const sign = reverse ? -1 : 1;
    const from = {
      [axis]: distance * sign,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
    };
    const to = { [axis]: 0, scale: 1, opacity: 1, duration, ease };
    if (blur > 0) {
      from.filter = 'blur(' + blur + 'px)';
      to.filter = 'blur(0px)';
    }
    if (rotate) {
      from.rotation = rotate * sign;
      to.rotation = 0;
    }
    if (tilt) {
      const tiltAxis = direction === 'horizontal' ? 'rotationY' : 'rotationX';
      from[tiltAxis] = (direction === 'horizontal' ? -1 : 1) * tilt * sign;
      to[tiltAxis] = 0;
      from.transformPerspective = 900;
    }
    const mask = WIPES[wipe];
    if (mask) {
      gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
      from['--ac-wipe'] = 0;
      to['--ac-wipe'] = 1;
    }
    if (stagger > 0) to.stagger = { each: stagger, from: staggerFrom };

    const settle = () => {
      if (scrub) return;
      gsap.set(targets, { clearProps: mask
        ? 'transform,opacity,filter,maskImage,webkitMaskImage,willChange'
        : 'transform,opacity,filter,willChange' });
    };
    let disappearTween;
    const tl = gsap.timeline({
      paused: true,
      onStart: () => callbacksRef.current.onStart?.(),
      onComplete: () => {
        settle();
        callbacksRef.current.onComplete?.();
        if (!once || scrub || disappearAfter <= 0) return;
        disappearTween = gsap.to(targets, {
          [axis]: -distance * sign,
          opacity: animateOpacity ? initialOpacity : 0,
          scale: 0.8,
          delay: disappearAfter,
          duration: disappearDuration,
          ease: disappearEase,
          onComplete: () => callbacksRef.current.onDisappearanceComplete?.(),
        });
      },
    });
    tl.fromTo(targets, from, to, Math.max(delay, 0));

    let scrollTrigger;
    let observer;
    if (trigger === 'mount') {
      tl.play();
    } else if (window.ScrollTrigger) {
      const ScrollTrigger = window.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      let scroller = container || document.getElementById('snap-main-container') || undefined;
      if (typeof scroller === 'string') scroller = document.querySelector(scroller) || undefined;
      scrollTrigger = ScrollTrigger.create({
        trigger: el, scroller,
        start: 'top ' + ((1 - threshold) * 100) + '%',
        ...(scrub ? {
          end: 'top ' + Math.max((1 - threshold) * 100 - 45, 5) + '%',
          scrub: scrub === true ? true : Math.max(Number(scrub) || 0.01, 0.01),
          animation: tl,
        } : {
          once,
          onEnter: () => tl.play(),
          onLeaveBack: once ? undefined : () => tl.reverse(),
        }),
      });
    } else if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (!entries[0]?.isIntersecting) return;
        tl.play();
        if (once) observer.disconnect();
      }, { rootMargin: '0px 0px -' + Math.min(90, Math.max(0, threshold * 100)) + '% 0px' });
      observer.observe(el);
    } else {
      tl.play();
    }
    return () => {
      scrollTrigger?.kill();
      observer?.disconnect();
      disappearTween?.kill();
      tl.kill();
      gsap.set(targets, { clearProps: 'transform,opacity,filter,maskImage,webkitMaskImage,willChange' });
    };
  }, [
    page, container, distance, direction, reverse, duration, ease,
    initialOpacity, animateOpacity, scale, blur, rotate, tilt, wipe,
    threshold, delay, stagger, staggerFrom, trigger, once, scrub,
    disappearAfter, disappearDuration, disappearEase,
  ]);

  if (page) return null;
  return <div ref={ref} className={'animated-content ' + className} style={style} {...props}>{children}</div>;
}
