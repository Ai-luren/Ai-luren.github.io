import { useRef } from 'react';

export default function CometCard({ children, className = '', ...props }) {
  const cardRef = useRef(null);

  const setCardState = (card, rotateX = '0deg', rotateY = '0deg', lift = '0px', scale = 1) => {
    card.style.setProperty('--comet-rotate-x', rotateX);
    card.style.setProperty('--comet-rotate-y', rotateY);
    card.style.setProperty('--comet-lift', lift);
    card.style.setProperty('--comet-press-scale', String(scale));
  };

  const handleMouseMove = event => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const left = Number.isFinite(rect.left) ? rect.left : rect.x;
    const top = Number.isFinite(rect.top) ? rect.top : rect.y;
    if (!rect.width || !rect.height || !Number.isFinite(left) || !Number.isFinite(top)) return;

    const rotateY = ((event.clientX - left - rect.width / 2) / 25).toFixed(2);
    const rotateX = ((event.clientY - top - rect.height / 2) / -25).toFixed(2);
    setCardState(card, `${rotateX}deg`, `${rotateY}deg`, '-4px');
  };

  const resetCard = () => {
    if (cardRef.current) setCardState(cardRef.current);
  };

  const handleMouseDown = () => {
    if (cardRef.current) cardRef.current.style.setProperty('--comet-press-scale', '.985');
  };

  const handleMouseUp = () => {
    if (cardRef.current) cardRef.current.style.setProperty('--comet-press-scale', '1');
  };

  return (
    <div
      ref={cardRef}
      className={`comet-card ${className}`.trim()}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetCard}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      {...props}
    >
      {children}
    </div>
  );
}
