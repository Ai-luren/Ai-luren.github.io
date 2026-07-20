import { useEffect, useRef } from 'react';
import { getGsap } from '../gsap-runtime.js';

export default function CometCard({ children, className = '', ...props }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const gsap = getGsap();
    if (!gsap) return undefined;
    const context = gsap.context(() => {
      const rotateXTo = gsap.quickTo(card, '--comet-rotate-x', { duration: .22, ease: 'power2.out' });
      const rotateYTo = gsap.quickTo(card, '--comet-rotate-y', { duration: .22, ease: 'power2.out' });
      const liftTo = gsap.quickTo(card, '--comet-lift', { duration: .22, ease: 'power2.out' });
      const reset = () => {
        rotateXTo('0deg');
        rotateYTo('0deg');
        liftTo('0px');
      };
      const handlePointerMove = event => {
        if (event.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        rotateYTo(`${(x - 0.5) * 12}deg`);
        rotateXTo(`${(0.5 - y) * 12}deg`);
        liftTo('-4px');
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
