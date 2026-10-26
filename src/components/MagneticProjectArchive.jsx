import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang, useT } from '../i18n/index.js';
import { FEATURED_PROJECTS } from '../data/projects.js';
import ProjectCard from './ProjectCard.jsx';
import { isImageReady, warmImages, warmNear } from '../utils/warmImage.js';
import { WORKS_HREF } from '../navigation/links.js';

export default function MagneticProjectArchive({ onSelect }) {
  const archiveRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const touchState = useRef({ startX: 0, startY: 0, moved: false, axis: 'none', pageAtStart: 0, suppressClickUntil: 0 });
  const pageTransitionTimer = useRef(null);
  const pageRequestRef = useRef(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  ));
  const [mobilePage, setMobilePage] = useState(0);
  const [mobilePageTransition, setMobilePageTransition] = useState('');
  const lang = useLang();
  const t = useT();

  const rubberBand = (distance, atBoundary) => (atBoundary ? distance * .35 : distance);

  const resetTouchVisual = (animate = true) => {
    const archive = archiveRef.current;
    if (!archive) return;
    archive.classList.toggle('is-touch-dragging', !animate);
    archive.style.setProperty('--mobile-swipe-x', '0px');
  };

  const changeMobilePage = async (nextPage, direction) => {
    const safePage = Math.max(0, Math.min(1, nextPage));
    if (safePage === mobilePage && !pageLoading) return;
    const token = ++pageRequestRef.current;
    const covers = FEATURED_PROJECTS.slice(safePage * 4, safePage * 4 + 4).map(item => item.cover);
    if (!covers.every(src => isImageReady(src))) {
      setPageLoading(true);
      await warmImages(covers);
    }
    if (token !== pageRequestRef.current) return;
    setPageLoading(false);
    window.clearTimeout(pageTransitionTimer.current);
    setMobilePageTransition(direction < 0 ? 'back' : 'forward');
    setMobilePage(safePage);
    pageTransitionTimer.current = window.setTimeout(() => setMobilePageTransition(''), 380);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchState.current = { startX: touch.clientX, startY: touch.clientY, moved: false, axis: 'none', pageAtStart: mobilePage, suppressClickUntil: 0 };
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchState.current.startX;
    const dy = touch.clientY - touchState.current.startY;
    const distanceX = Math.abs(dx);
    const distanceY = Math.abs(dy);
    if (distanceX > 10 || distanceY > 10) {
      touchState.current.moved = true;
      if (touchState.current.axis === 'none') {
        touchState.current.axis = distanceX > distanceY ? 'horizontal' : 'vertical';
      }
    }
    if (touchState.current.axis === 'horizontal' && archiveRef.current) {
      const atBoundary = (touchState.current.pageAtStart === 0 && dx > 0)
        || (touchState.current.pageAtStart === 1 && dx < 0);
      archiveRef.current.classList.add('is-touch-dragging');
      archiveRef.current.style.setProperty('--mobile-swipe-x', `${rubberBand(dx, atBoundary)}px`);
    }
  };

  const handleTouchEnd = (event) => {
    if (!isMobile) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const distanceX = touch.clientX - touchState.current.startX;
    const distanceY = touch.clientY - touchState.current.startY;
    const isHorizontalSwipe = touchState.current.axis === 'horizontal'
      && Math.abs(distanceX) > 42
      && Math.abs(distanceX) > Math.abs(distanceY);
    if (isHorizontalSwipe) {
      touchState.current.suppressClickUntil = Date.now() + 450;
      resetTouchVisual(true);
      changeMobilePage(touchState.current.pageAtStart + (distanceX < 0 ? 1 : -1), distanceX);
    } else if (touchState.current.moved) {
      touchState.current.suppressClickUntil = Date.now() + 250;
      resetTouchVisual(true);
    }
  };

  const handleTouchCancel = () => {
    resetTouchVisual(true);
    touchState.current = { startX: 0, startY: 0, moved: false, axis: 'none', pageAtStart: mobilePage, suppressClickUntil: 0 };
  };

  useEffect(() => () => {
    pageRequestRef.current++;
    window.clearTimeout(pageTransitionTimer.current);
  }, []);

  useEffect(() => warmNear(
    document.getElementById('projects') || archiveRef.current,
    FEATURED_PROJECTS.map(item => item.cover),
  ), []);

  const handlePageKeyDown = (event) => {
    if (!isMobile) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    changeMobilePage(mobilePage + (event.key === 'ArrowRight' ? 1 : -1), event.key === 'ArrowRight' ? 1 : -1);
  };

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
    if (dragState.current.moved && event?.pointerId != null) {
      archive.releasePointerCapture?.(event.pointerId);
    }
    dragState.current.active = false;
    archive.classList.remove('is-dragging');
  };

  const handleCardClick = (event, project) => {
    // Keep the existing swipe/drag suppression; clean clicks open the cinema player.
    if (dragState.current.moved || touchState.current.moved || Date.now() < touchState.current.suppressClickUntil) {
      event.preventDefault();
      dragState.current.moved = false;
      touchState.current = { startX: 0, startY: 0, moved: false, axis: 'none', pageAtStart: mobilePage, suppressClickUntil: 0 };
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
    const updateScrollHint = () => {
      setCanScroll(archive.scrollWidth - archive.clientWidth - archive.scrollLeft > 8);
    };
    updateScrollHint();
    archive.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint, { passive: true });
    return () => {
      archive.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, []);

  const visibleArchives = isMobile ? FEATURED_PROJECTS.slice(mobilePage * 4, mobilePage * 4 + 4) : FEATURED_PROJECTS;
  const mobilePreviousDisabled = mobilePage === 0;
  const mobileNextDisabled = mobilePage === 1;
  const libraryLinkRoot = document.getElementById('projects-library-link');
  const featuredNoteRoot = document.getElementById('projects-featured-note');
  const libraryLink = <div className="archive-more"><a href={WORKS_HREF}>{t('浏览全部作品', 'Browse All Work')}</a></div>;

  return (
    <>
      {featuredNoteRoot && createPortal(t(`${FEATURED_PROJECTS.length} 部代表作品`, `${FEATURED_PROJECTS.length} Featured Works`), featuredNoteRoot)}
      {!isMobile && libraryLinkRoot && createPortal(libraryLink, libraryLinkRoot)}
      <div className={`comet-archive-mobile-shell${mobilePageTransition ? ` is-page-${mobilePageTransition}` : ''}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel}>
      <button className="comet-archive-page-arrow comet-archive-page-arrow--prev" type="button" aria-label={lang === 'en' ? 'Previous project page' : '上一页作品'} disabled={!isMobile || mobilePreviousDisabled} onClick={() => changeMobilePage(mobilePage - 1, -1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 5-7 7 7 7" /></svg>
      </button>
      <div key={isMobile ? mobilePage : 'desktop'} ref={archiveRef} className="comet-archive" role="list" aria-label={lang === 'en' ? 'AI video work archive' : 'AI 视频创作档案'} tabIndex={isMobile ? 0 : undefined} onKeyDown={handlePageKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging}>
      {visibleArchives.map(project => (
        <ProjectCard key={project.id} project={project} lang={lang} onClick={handleCardClick} />
      ))}
      </div>
      <button className="comet-archive-page-arrow comet-archive-page-arrow--next" type="button" aria-label={lang === 'en' ? 'Next project page' : '下一页作品'} disabled={!isMobile || mobileNextDisabled} onClick={() => changeMobilePage(mobilePage + 1, 1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8.5 5 7 7-7 7" /></svg>
      </button>
      <div className="comet-archive-pagination" role="tablist" aria-label={lang === 'en' ? 'Select project page' : '选择作品页'}>
        {[0, 1].map((page) => (
        <button key={page} type="button" role="tab" aria-selected={isMobile && mobilePage === page} aria-label={lang === 'en' ? `Show project page ${page + 1}` : `查看第${page + 1}页作品`} className={isMobile && mobilePage === page ? 'is-active' : ''} onClick={() => changeMobilePage(page, page > mobilePage ? 1 : -1)} />
        ))}
      </div>
      </div>
      {canScroll && <p className="comet-archive__scroll-hint" aria-hidden="true">{lang === 'en' ? 'Swipe to explore ' : '左右滑动查看更多 '}<span>→</span></p>}
      {isMobile && libraryLink}
    </>
  );
}
