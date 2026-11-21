import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang, useT } from '../i18n/index.js';
import { FEATURED_PROJECTS } from '../data/projects.js';
import ProjectCard from './ProjectCard.jsx';
import { WORKS_HREF } from '../navigation/links.js';

// The same eight Featured works are always visible. On phones the two-column
// editorial grid scrolls naturally (four rows); no hidden page, arrow or extra
// glass shell. Desktop keeps the existing four-column card system.
export default function MagneticProjectArchive({ onSelect, onViewerIntent }) {
  const archiveRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const [canScroll, setCanScroll] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  ));
  const lang = useLang();
  const t = useT();

  const handlePointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const archive = archiveRef.current;
    if (!archive) return;
    dragState.current = { active: true, startX: event.clientX, startScrollLeft: archive.scrollLeft, moved: false };
    archive.classList.add('is-dragging');
  };

  const handlePointerMove = (event) => {
    const archive = archiveRef.current;
    const state = dragState.current;
    if (!archive || !state.active) return;
    const distance = event.clientX - state.startX;
    if (Math.abs(distance) <= 10) return;
    if (!state.moved) {
      state.moved = true;
      archive.setPointerCapture?.(event.pointerId);
    }
    archive.scrollLeft = state.startScrollLeft - distance;
  };

  const stopDragging = (event) => {
    const archive = archiveRef.current;
    if (!archive) return;
    if (dragState.current.moved && event?.pointerId != null && archive.hasPointerCapture?.(event.pointerId)) {
      archive.releasePointerCapture(event.pointerId);
    }
    dragState.current.active = false;
    archive.classList.remove('is-dragging');
  };

  const handleCardClick = (event, project) => {
    if (dragState.current.moved) {
      event.preventDefault();
      dragState.current.moved = false;
      return;
    }
    event.preventDefault();
    onSelect(project, event.target.closest('.comet-archive__card'));
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const updateViewport = () => setIsMobile(media.matches);
    updateViewport();
    media.addEventListener?.('change', updateViewport);
    return () => media.removeEventListener?.('change', updateViewport);
  }, []);

  useEffect(() => {
    const archive = archiveRef.current;
    if (!archive) return undefined;
    const updateScrollHint = () => setCanScroll(archive.scrollWidth - archive.clientWidth - archive.scrollLeft > 8);
    updateScrollHint();
    archive.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint, { passive: true });
    return () => {
      archive.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, []);

  const libraryLinkRoot = document.getElementById('projects-library-link');
  const libraryLink = <div className="archive-more"><a href={WORKS_HREF}><span className="portfolio-link-label">{t('浏览全部作品', 'Browse All Work')}</span></a></div>;

  return (
    <>
      {libraryLinkRoot && createPortal(libraryLink, libraryLinkRoot)}
      <div className="comet-archive-mobile-shell">
        <div ref={archiveRef} className="comet-archive" role="list"
          aria-label={lang === 'en' ? 'AI video work archive' : 'AI 视频创作档案'}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={stopDragging} onPointerCancel={stopDragging}>
          {FEATURED_PROJECTS.map((project, index) => (
            <ProjectCard key={project.id} project={project} lang={lang}
              onClick={handleCardClick} onViewerIntent={onViewerIntent}
              coverPriority={index < (isMobile ? 2 : 4) ? (isMobile ? 'high' : 'normal') : index < (isMobile ? 4 : 8) ? 'normal' : 'low'}
              deferUntilNear={index >= (isMobile ? 2 : 4)} />
          ))}
        </div>
      </div>
      {canScroll && !isMobile && <p className="comet-archive__scroll-hint" aria-hidden="true">
        {lang === 'en' ? 'Swipe to explore ' : '左右滑动查看更多 '}<span>→</span>
      </p>}
    </>
  );
}
