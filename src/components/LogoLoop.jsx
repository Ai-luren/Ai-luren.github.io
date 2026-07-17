import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './LogoLoop.css';

const MIN_COPIES = 2;
const COPY_HEADROOM = 2;

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

function useResizeObserver(callback, elements, dependencies) {
  useEffect(() => {
    if (!window.ResizeObserver) {
      window.addEventListener('resize', callback);
      callback();
      return () => window.removeEventListener('resize', callback);
    }

    const observers = elements.map((elementRef) => {
      if (!elementRef.current) return null;
      const observer = new ResizeObserver(callback);
      observer.observe(elementRef.current);
      return observer;
    });

    callback();
    return () => observers.forEach((observer) => observer?.disconnect());
  }, [callback, elements, dependencies]);
}

function useImageLoader(sequenceRef, onLoad, dependencies) {
  useEffect(() => {
    const images = sequenceRef.current?.querySelectorAll('img') ?? [];
    if (images.length === 0) {
      onLoad();
      return undefined;
    }

    let remainingImages = images.length;
    const handleImageLoad = () => {
      remainingImages -= 1;
      if (remainingImages === 0) onLoad();
    };

    images.forEach((image) => {
      if (image.complete) handleImageLoad();
      else {
        image.addEventListener('load', handleImageLoad, { once: true });
        image.addEventListener('error', handleImageLoad, { once: true });
      }
    });

    return () => {
      images.forEach((image) => {
        image.removeEventListener('load', handleImageLoad);
        image.removeEventListener('error', handleImageLoad);
      });
    };
  }, [onLoad, sequenceRef, dependencies]);
}

function useAnimationLoop(trackRef, velocity, sequenceWidth, isHovered, hoverSpeed) {
  const frameRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      track.style.transform = 'translate3d(0, 0, 0)';
      return undefined;
    }

    if (sequenceWidth > 0) {
      offsetRef.current = ((offsetRef.current % sequenceWidth) + sequenceWidth) % sequenceWidth;
      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
    }

    const animate = (timestamp) => {
      if (lastTimestampRef.current === null) lastTimestampRef.current = timestamp;
      const deltaTime = Math.max(0, timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      const target = isHovered && hoverSpeed !== undefined ? hoverSpeed : velocity;
      const easingFactor = 1 - Math.exp(-deltaTime / 0.25);
      velocityRef.current += (target - velocityRef.current) * easingFactor;

      if (sequenceWidth > 0) {
        offsetRef.current = ((offsetRef.current + velocityRef.current * deltaTime) % sequenceWidth + sequenceWidth) % sequenceWidth;
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastTimestampRef.current = null;
    };
  }, [trackRef, velocity, sequenceWidth, isHovered, hoverSpeed]);
}

const LogoLoop = memo(function LogoLoop({
  logos,
  speed = 120,
  direction = 'left',
  logoHeight = 42,
  gap = 52,
  hoverSpeed,
  scaleOnHover = false,
  ariaLabel = 'Partner logos',
  className,
  style
}) {
  const containerRef = useRef(null);
  const sequenceRef = useRef(null);
  const trackRef = useRef(null);
  const [sequenceWidth, setSequenceWidth] = useState(0);
  const [copyCount, setCopyCount] = useState(MIN_COPIES);
  const [isHovered, setIsHovered] = useState(false);

  const updateDimensions = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const width = sequenceRef.current?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    setSequenceWidth(Math.ceil(width));
    setCopyCount(Math.max(MIN_COPIES, Math.ceil(containerWidth / width) + COPY_HEADROOM));
  }, []);

  useResizeObserver(updateDimensions, [containerRef, sequenceRef], [logos, logoHeight, gap]);
  useImageLoader(sequenceRef, updateDimensions, [logos, logoHeight, gap]);

  const directionMultiplier = direction === 'right' ? -1 : 1;
  const targetVelocity = Math.abs(speed) * directionMultiplier * (speed < 0 ? -1 : 1);
  useAnimationLoop(trackRef, targetVelocity, sequenceWidth, isHovered, hoverSpeed);

  const renderLogoItem = useCallback((logo, key) => (
    <li className={joinClasses('logo-loop__item', scaleOnHover && 'logo-loop__item--hoverable')} key={key}>
      {logo.href ? (
        <a className="logo-loop__link" href={logo.href} target="_blank" rel="noreferrer noopener" aria-label={logo.alt || logo.title}>
          <img className={joinClasses('logo-loop__image', logo.className)} src={logo.src} alt={logo.alt ?? ''} title={logo.title} draggable="false" />
        </a>
      ) : (
        <img className={joinClasses('logo-loop__image', logo.className)} src={logo.src} alt={logo.alt ?? ''} title={logo.title} draggable="false" />
      )}
    </li>
  ), [scaleOnHover]);

  const logoLists = useMemo(() => Array.from({ length: Math.max(0, copyCount - 1) }, (_, copyIndex) => (
    <ul className="logo-loop__list" key={`copy-${copyIndex}`} aria-hidden="true">
      {logos.map((logo, logoIndex) => renderLogoItem(logo, `${copyIndex}-${logoIndex}`))}
    </ul>
  )), [copyCount, logos, renderLogoItem]);

  const cssVariables = {
    '--logo-loop-gap': `${gap}px`,
    '--logo-loop-height': `${logoHeight}px`,
    ...style
  };

  return (
    <div
      ref={containerRef}
      className={joinClasses('logo-loop', className)}
      style={cssVariables}
      role="region"
      aria-label={ariaLabel}
      onMouseEnter={() => hoverSpeed !== undefined && setIsHovered(true)}
      onMouseLeave={() => hoverSpeed !== undefined && setIsHovered(false)}
    >
      <div className="logo-loop__track" ref={trackRef}>
        <ul className="logo-loop__list" ref={sequenceRef} aria-hidden="false">
          {logos.map((logo, logoIndex) => renderLogoItem(logo, `sequence-${logoIndex}`))}
        </ul>
        {logoLists}
      </div>
    </div>
  );
});

LogoLoop.displayName = 'LogoLoop';

export default LogoLoop;
