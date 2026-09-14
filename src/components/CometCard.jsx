import { useRef } from 'react';

export default function CometCard({ children, className = '', enableTilt = true, tiltStrength = 48, ...props }) {
  const cardRef = useRef(null);

  const setCardState = (card, rotateX = '0deg', rotateY = '0deg', lift = '0px', scale = 1) => {
    card.style.setProperty('--comet-rotate-x', rotateX);
    card.style.setProperty('--comet-rotate-y', rotateY);
    card.style.setProperty('--comet-lift', lift);
    card.style.setProperty('--comet-press-scale', String(scale));
  };

  const handleMouseMove = event => {
    const card = cardRef.current;
    if (!card || !enableTilt) return;

    const rect = card.getBoundingClientRect();
    const left = Number.isFinite(rect.left) ? rect.left : rect.x;
    const top = Number.isFinite(rect.top) ? rect.top : rect.y;
    if (!rect.width || !rect.height || !Number.isFinite(left) || !Number.isFinite(top)) return;

    const rotateY = ((event.clientX - left - rect.width / 2) / tiltStrength).toFixed(2);
    const rotateX = ((event.clientY - top - rect.height / 2) / -tiltStrength).toFixed(2);
    setCardState(card, `${rotateX}deg`, `${rotateY}deg`, '0px');
  };

  const resetCard = () => {
    if (cardRef.current) setCardState(cardRef.current);
  };

  const handlePointerDown = () => {
    if (cardRef.current) cardRef.current.style.setProperty('--comet-press-scale', '.985');
  };

  const handlePointerUp = () => {
    if (cardRef.current) cardRef.current.style.setProperty('--comet-press-scale', '1');
  };

  const handlePointerLeave = () => {
    if (cardRef.current) setCardState(cardRef.current);
  };

  return (
    <div
      ref={cardRef}
      className={`comet-card ${enableTilt ? '' : 'comet-card--static'} ${className}`.trim()}
      onMouseMove={enableTilt ? handleMouseMove : undefined}
      onMouseLeave={enableTilt ? resetCard : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      {...props}
    >
      {children}
    </div>
  );
}
