import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import './TextType.css';

export default function TextType({
  text,
  as: Component = 'div',
  startWithFullText = false,
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  reverseMode = false,
  ...props
}) {
  // On an initial Hero mount, show the complete role immediately rather
  // than briefly exposing a one-character headline over the preloaded frame.
  // Subsequent rotations retain the existing typing/deleting animation.
  const initialText = startWithFullText
    ? (Array.isArray(text) ? text[0] : text) || ''
    : '';
  const [displayedText, setDisplayedText] = useState(initialText);
  const [currentCharIndex, setCurrentCharIndex] = useState([...initialText].length);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [heroInView, setHeroInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  );
  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  useEffect(() => {
    const section = document.getElementById('top');
    if (!section || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setHeroInView(Boolean(entry?.isIntersecting));
    }, {rootMargin: '120px 0px 120px 0px', threshold: 0});
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  // Only text that is actually on screen needs a timer. While offscreen or
  // reduced, hold a COMPLETE role to avoid returning to a half-deleted word.
  const typingActive = heroInView && !reducedMotion;
  useEffect(() => {
    if (typingActive) return;
    const complete = textArray[currentTextIndex] || '';
    const role = reverseMode ? [...complete].reverse().join('') : complete;
    setDisplayedText(previous => previous === role ? previous : role);
    setCurrentCharIndex([...role].length);
    setIsDeleting(false);
  }, [typingActive, currentTextIndex, reverseMode, textArray]);

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    return Math.random() * (variableSpeed.max - variableSpeed.min) + variableSpeed.min;
  }, [typingSpeed, variableSpeed]);


  // The cursor uses a composited CSS pulse, paused outside the Hero. A
  // permanently repeating GSAP tween kept the global 60fps ticker alive
  // even after readers had scrolled several screens past the headline.

  useEffect(() => {
    if (!typingActive) return undefined;
    let timeout;
    const currentText = textArray[currentTextIndex] || '';
    const processedText = reverseMode ? [...currentText].reverse().join('') : currentText;

    const tick = () => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false);
          if (currentTextIndex === textArray.length - 1 && !loop) return;
          onSentenceComplete?.(currentText, currentTextIndex);
          setCurrentTextIndex((index) => (index + 1) % textArray.length);
          setCurrentCharIndex(0);
        } else {
          setDisplayedText((value) => value.slice(0, -1));
        }
        return;
      }

      if (currentCharIndex < processedText.length) {
        setDisplayedText((value) => value + processedText[currentCharIndex]);
        setCurrentCharIndex((index) => index + 1);
      } else if (textArray.length > 1 || loop) {
        if (!loop && currentTextIndex === textArray.length - 1) return;
        setIsDeleting(true);
      }
    };

    const delay = currentCharIndex === 0 && !isDeleting && displayedText === ''
      ? initialDelay
      : isDeleting ? deletingSpeed : currentCharIndex >= processedText.length ? pauseDuration : getRandomSpeed();
    timeout = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timeout);
  }, [currentCharIndex, currentTextIndex, deletingSpeed, displayedText, getRandomSpeed, initialDelay, isDeleting, loop, onSentenceComplete, pauseDuration, reverseMode, textArray, typingActive]);

  // 删除到空字时不把光标留在行首，避免出现第二条独立横线。
  // 有内容时光标自然紧跟在文字末尾，位置与 TextType 参考效果一致。
  const shouldHideCursor = displayedText.length === 0 || (hideCursorWhileTyping && (currentCharIndex < (textArray[currentTextIndex] || '').length || isDeleting));
  const color = textColors.length ? textColors[currentTextIndex % textColors.length] : 'inherit';

  return createElement(
    Component,
    { className: `text-type ${className}`.trim(), ...props },
    <span className="text-type__content" style={{ color }}>{displayedText}</span>,
    showCursor && <span className={`text-type__cursor ${cursorClassName} ${shouldHideCursor ? 'text-type__cursor--hidden' : ''}`} style={{ '--text-type-cursor-blink-duration': `${cursorBlinkDuration}s` }}>{cursorCharacter}</span>,
  );
}
