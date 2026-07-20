import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGsap } from '../gsap-runtime.js';
import './TextType.css';

export default function TextType({
  text,
  as: Component = 'div',
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
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const cursorRef = useRef(null);
  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    return Math.random() * (variableSpeed.max - variableSpeed.min) + variableSpeed.min;
  }, [typingSpeed, variableSpeed]);

  useEffect(() => {
    if (!showCursor || !cursorRef.current) return undefined;
    const cursor = cursorRef.current;
    const gsap = getGsap();
    if (!gsap) return undefined;
    gsap.killTweensOf(cursor);
    const context = gsap.context(() => {
      gsap.set(cursor, { opacity: 1 });
      gsap.to(cursor, {
        opacity: 0,
        duration: cursorBlinkDuration,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
    }, cursor);

    return () => {
      context.revert();
      gsap.killTweensOf(cursor);
    };
  }, [showCursor, cursorBlinkDuration]);

  useEffect(() => {
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
  }, [currentCharIndex, currentTextIndex, deletingSpeed, displayedText, getRandomSpeed, initialDelay, isDeleting, loop, onSentenceComplete, pauseDuration, reverseMode, textArray]);

  // 删除到空字时不把光标留在行首，避免出现第二条独立横线。
  // 有内容时光标自然紧跟在文字末尾，位置与 TextType 参考效果一致。
  const shouldHideCursor = displayedText.length === 0 || (hideCursorWhileTyping && (currentCharIndex < (textArray[currentTextIndex] || '').length || isDeleting));
  const color = textColors.length ? textColors[currentTextIndex % textColors.length] : 'inherit';

  return createElement(
    Component,
    { className: `text-type ${className}`.trim(), ...props },
    <span className="text-type__content" style={{ color }}>{displayedText}</span>,
    showCursor && <span ref={cursorRef} className={`text-type__cursor ${cursorClassName} ${shouldHideCursor ? 'text-type__cursor--hidden' : ''}`}>{cursorCharacter}</span>,
  );
}
