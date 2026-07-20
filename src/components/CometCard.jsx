import gsap from 'gsap';
import { useEffect, useRef } from 'react';

export default function CometCard({ children, className = '', ...props }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const context = gsap.context(() => {
      const rotateXTo = gsap.quickTo(card, '--comet-rotate-x', { duration: .22, ease: 'power2.out', unit: 'deg' });
      const rotateYTo = gsap.quickTo(card, '--comet-rotate-y', { duration: .22, ease: 'power2.out', unit: 'deg' });
      const liftTo = gsap.quickTo(card, '--comet-lift', { duration: .22, ease: 'power2.out', unit: 'px' });
      const reset = () => {
        rotateXTo(0);
        rotateYTo(0);
        liftTo(0);
      };
      const handlePointerMove = event => {
        if (event.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        rotateYTo((x - 0.5) * 12);
        rotateXTo((0.5 - y) * 12);
        liftTo(-4);
      };
      const handlePointerDown = () => {
        gsap.to(card, { '--comet-press-scale': .985, duration: .1, ease: 'power2.out', overwrite: 'auto' });
      };
      const handlePointerUp = () => {
        gsap.to(card, { '--comet-press-scale': 1, duration: .24, ease: 'back.out(2)', overwrite: 'auto' });
      };

      card.addEventListener('pointermove', handlePointerMove);
      card.addEventListener('pointerleave', reset);
      card.addEventListener('pointerdown', handlePointerDown);
      card.addEventListener('pointerup', handlePointerUp);
      card.addEventListener('pointercancel', handlePointerUp);

      return () => {
        card.removeEventListener('pointermove', handlePointerMove);
        card.removeEventListener('pointerleave', reset);
        card.removeEventListener('pointerdown', handlePointerDown);
        card.removeEventListener('pointerup', handlePointerUp);
        card.removeEventListener('pointercancel', handlePointerUp);
      };
    }, card);

    return () => context.revert();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`comet-card ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
