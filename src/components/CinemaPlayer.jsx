import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/index.js';
import { PROJECT_CATEGORIES } from '../data/projects.js';
import {projectVideoVersions,initialProjectPoster} from '../data/version-order.js';
import './CinemaPlayer.css';
import CinemaNavigation from './CinemaNavigation.jsx';
import { WORKS_HREF } from '../navigation/links.js';
import {useLocalArtworkRevision,revisionedArtworkUrl,currentLocalArtworkRevision} from '../utils/localPreviewArtwork.js';
import { warmImage } from '../utils/warmImage.js';

// A stale or unreachable asset must not strand the viewer indefinitely.
async function readyArtwork(url, deadline = 8000) {
  let timeout;
  try {
    return await Promise.race([
      warmImage(url),
      new Promise(resolve => { timeout = window.setTimeout(() => resolve(false), deadline); }),
    ]);
  } finally { window.clearTimeout(timeout); }
}

export default function CinemaPlayer({ project, projects = [], onSelect, context = 'featured', onClose, returnFocusRef }) {
  const lang = useLang();
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const closeRef = useRef(null);
  const informationRef = useRef(null);
  const layoutRef = useRef(null);
  const bodyRef = useRef(null);
  const navRef = useRef(null);
  const switchingRef = useRef(false);
  const switchFocusRef = useRef(null);
  const versionRequestRef = useRef(0);
  const [versionPendingIndex, setVersionPendingIndex] = useState(null);
  const [fallbackVersionPoster, setFallbackVersionPoster] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [versionSelection, setVersionSelection] = useState({ projectId: project?.id, index: 0 });
  const versions = projectVideoVersions(project);
  const versionIndex = versionSelection.projectId === project?.id ? versionSelection.index : 0;
  const currentVersion = versions[versionIndex] || versions[0];
  const coverRevision=useLocalArtworkRevision('cover',project?.id);
  const posterRevision=useLocalArtworkRevision('poster',project?.id,currentVersion?.id||'main');
  const fallbackForCurrentVersion = fallbackVersionPoster?.projectId === project?.id
    && fallbackVersionPoster?.versionId === currentVersion?.id;
  const versionPoster = revisionedArtworkUrl(
    fallbackForCurrentVersion ? project?.cover : currentVersion?.playerPoster || project?.cover,
    fallbackForCurrentVersion || !currentVersion?.playerPoster ? coverRevision : posterRevision,
  );
  // The first displayed version may now be a reordered extension or the
  // original main may be archived; initialize with the *visible* video's
  // proportions to avoid flashing the original main aspect ratio.
  const [dimensions, setDimensions] = useState(() => currentVersion?.videoWidth > 0 && currentVersion?.videoHeight > 0
    ? { width: currentVersion.videoWidth, height: currentVersion.videoHeight } : null);
  const cancelFrameRef = useRef(null);
  const frameReadyRef = useRef(false);
  const attemptRef = useRef(0);
  const requestedRef = useRef(false);
  const [size, setSize] = useState(null);
  const [status, setStatus] = useState('idle');
  const [started, setStarted] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [motionVisible, setMotionVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef(null);
  const failed = status === 'error';
  const playing = status === 'playing';
  const videoUrl = currentVersion?.videoUrl?.trim();
  const secondaryLabel = [PROJECT_CATEGORIES.find(category => category.id === project?.category)?.label[lang], project?.award[lang]].filter(Boolean).join(' · ');

  const index = projects.findIndex(item => item.id === project?.id);
  const stop = () => {
    attemptRef.current++;
    requestedRef.current = false;
    cancelFrameRef.current?.();
    const video = videoRef.current;
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  };

  useLayoutEffect(() => {
    if (!project) return undefined;
    const dialog = dialogRef.current;
    // Source cards are owned by another portal and may lose activeElement
    // during React reconciliation. Preserve the original activation target.
    const trigger = returnFocusRef?.current?.isConnected ? returnFocusRef.current : document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const scroll = [window.scrollX, window.scrollY];
    document.body.style.overflow = 'hidden';
    document.body.classList.add('cinema-open');
    if (!dialog.open) dialog.showModal();
    let entranceFrame = requestAnimationFrame(() => {
      entranceFrame = requestAnimationFrame(() => {
        if (!closingRef.current) setMotionVisible(true);
      });
    });
    closeRef.current?.focus({ preventScroll: true });
    const pauseWhenHidden = () => { if (document.hidden) videoRef.current?.pause(); };
    const closeForHistory = () => { stop(); onClose(); };
    const stopForPageHide = () => videoRef.current?.pause();
    document.addEventListener('visibilitychange', pauseWhenHidden);
    window.addEventListener('popstate', closeForHistory);
    window.addEventListener('pagehide', stopForPageHide);
    return () => {
      cancelAnimationFrame(entranceFrame);
      window.clearTimeout(closeTimerRef.current);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      window.removeEventListener('popstate', closeForHistory);
      window.removeEventListener('pagehide', stopForPageHide);
      if (dialog.open) dialog.close();
      document.body.classList.remove('cinema-open');
      document.body.style.overflow = previousOverflow;
      window.scrollTo(scroll[0], scroll[1]);
      // React portals can briefly detach the source card while rekeying the
      // viewer. Restore focus after its source card is connected again.
      requestAnimationFrame(() => {
        if (trigger?.isConnected && !document.querySelector('.cinema-player[open]')) {
          trigger.focus({ preventScroll: true });
        }
      });
    };
  }, [Boolean(project)]);

  useLayoutEffect(() => {
    versionRequestRef.current++;
    setVersionPendingIndex(null);
    setFallbackVersionPoster(project?.preparedVersionPosterFallback
      ? {projectId:project.id,versionId:projectVideoVersions(project)[0]?.id} : null);
  }, [project?.id]);

  useLayoutEffect(() => {
    if (!project) return;
    const video = videoRef.current;
    setDimensions(currentVersion?.videoWidth > 0 && currentVersion?.videoHeight > 0 ? {width:currentVersion.videoWidth,height:currentVersion.videoHeight}:null);
    attemptRef.current++;
    requestedRef.current = false;
    setStarted(false);setStatus('idle');setPlayBlocked(false);frameReadyRef.current=false;
    // No src until an explicit play action: opening/switching costs no video bytes.
    if(video){video.pause();video.removeAttribute('src');video.load();}
    if(dialogRef.current) dialogRef.current.scrollTop=0;
    if(switchFocusRef.current) {
      const buttons=dialogRef.current?.querySelectorAll('.cinema-player__sequence button');
      const target=buttons?.[switchFocusRef.current==='next'?1:0];
      (target && !target.disabled ? target : Array.from(buttons || []).find(button=>!button.disabled) || closeRef.current)?.focus({preventScroll:true});
      switchFocusRef.current=null;
    }
    return () => { cancelFrameRef.current?.(); if(video){video.pause();video.removeAttribute('src');video.load();} };
  }, [project?.id, currentVersion?.id, videoUrl]);

  useLayoutEffect(() => {
    if (!dimensions) return undefined;
    const fit = () => {
      if (document.fullscreenElement) return;
      const viewport = window.visualViewport;
      const width = Math.min(viewport?.width || window.innerWidth, document.documentElement.clientWidth);
      const height = Math.min(viewport?.height || window.innerHeight, window.innerHeight);
      const layoutStyle = getComputedStyle(layoutRef.current);
      const horizontalPadding = parseFloat(layoutStyle.paddingLeft) + parseFloat(layoutStyle.paddingRight);
      const verticalPadding = parseFloat(layoutStyle.paddingTop) + parseFloat(layoutStyle.paddingBottom);
      const ratio = dimensions.width / dimensions.height;
      const maxWidth = Math.max(1, Math.min(980, width - horizontalPadding));
      const body = bodyRef.current;
      let fittedWidth = maxWidth;
      // Reserve the whole information group, including the single bottom arrow
      // pair and return link, before fitting the real video ratio.
      for (let pass = 0; pass < 6; pass++) {
        body.style.width = `${fittedWidth}px`;
        const informationStyle = getComputedStyle(informationRef.current);
        const informationHeight = informationRef.current.getBoundingClientRect().height + parseFloat(informationStyle.marginTop);
        const availableHeight = height - verticalPadding - informationHeight;
        // Only genuinely short viewports scroll; normal phones fit every action.
        // In very short views, scroll instead of squeezing the circular controls
        // and centered count into a media column narrower than their touch areas.
        const minimumHeight = ratio < 1 ? Math.min(maxWidth / ratio, Math.max(240, Math.min(200, maxWidth) / ratio)) : 120;
        const nextWidth = Math.min(maxWidth, Math.min(880, Math.max(minimumHeight, availableHeight)) * ratio);
        if (Math.abs(nextWidth - fittedWidth) < .1) break;
        fittedWidth = nextWidth;
      }
      body.style.width = `${fittedWidth}px`;
      setSize(previous => previous && Math.abs(previous.width - fittedWidth) < .1 && Math.abs(previous.height - fittedWidth / ratio) < .1
        ? previous : { width: fittedWidth, height: fittedWidth / ratio });
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (informationRef.current) observer.observe(informationRef.current);
    if (navRef.current) observer.observe(navRef.current);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    document.addEventListener('fullscreenchange', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      document.removeEventListener('fullscreenchange', fit);
    };
  }, [dimensions, lang, project?.id]);

  // Don't preload neighboring posters while the visitor is about to play a
  // film. On slower networks those image requests compete with the MP4 first
  // frame. Navigation controls warm the target when the visitor shows intent.

  if (!project) return null;
  const dismiss = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    versionRequestRef.current++;
    stop(); // Release media immediately; the visual exit is video-free.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }
    setIsClosing(true);
    setMotionVisible(false);
    closeTimerRef.current = window.setTimeout(onClose, 220);
  };
  const switchWork = async nextIndex => {
    if(nextIndex < 0 || nextIndex >= projects.length || !onSelect || switchingRef.current || closingRef.current) return;
    const controls=dialogRef.current?.querySelectorAll('.cinema-player__sequence button');
    switchFocusRef.current=document.activeElement===controls?.[1]?'next':document.activeElement===controls?.[0]?'previous':null;
    switchingRef.current = true;
    setSwitching(true);
    versionRequestRef.current++; // Cancel any pending A/B poster switch.
    setVersionPendingIndex(null);
    videoRef.current?.pause();
    const next = projects[nextIndex];
    // Keep the outgoing frame visible until the incoming poster is decoded.
    // The old 1.5-second deadline could force a black screen on slow networks.
    let prepared = next;
    try {
      if (!await readyArtwork(initialProjectPoster(next))) {
        if (!await readyArtwork(next.cover)) return;
        prepared = { ...next, preparedVersionPosterFallback: true };
      }
      if (!dialogRef.current?.open || closingRef.current) return;
      stop();
      onSelect(prepared);
    } finally {
      switchingRef.current = false;
      if (!closingRef.current && dialogRef.current?.open) setSwitching(false);
    }
  };
  const play = async (reload = false) => {
    const video = videoRef.current;
    if (!video || !videoUrl || switchingRef.current) return;
    const attempt = ++attemptRef.current;
    requestedRef.current = true;
    setPlayBlocked(false);
    setStatus('loading');
    try {
      if (reload || !video.getAttribute('src')) {
        video.pause();
        cancelFrameRef.current?.();
        frameReadyRef.current = false;
        setStarted(false);
        video.src = videoUrl;
        video.load();
      }
      // Call play in the same user gesture, including retries (Safari audio policy).
      await video.play();
      if (video !== videoRef.current || !video.isConnected || !dialogRef.current?.open || document.hidden) video.pause();
    } catch (error) {
      if (video !== videoRef.current || !video.isConnected || attempt !== attemptRef.current) return;
      if (error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        setStatus('paused');
        setPlayBlocked(true);
      } else {
        setStatus('error');
        setStarted(false);
      }
    }
  };
  const retry = () => play(true);
  const chooseVersion = async nextIndex => {
    if (closingRef.current || switchingRef.current || nextIndex < 0 || nextIndex >= versions.length) return;
    if (nextIndex === versionIndex) {
      // Tapping the active version while another is pending cancels that swap.
      versionRequestRef.current++;
      setVersionPendingIndex(null);
      return;
    }
    const token = ++versionRequestRef.current;
    const next = versions[nextIndex];
    setVersionPendingIndex(nextIndex);
    videoRef.current?.pause();
    const src = next.playerPoster || project.cover;
    const revision = next.playerPoster
      ? currentLocalArtworkRevision('poster', project.id, next.id)
      : coverRevision;
    const targetPoster = revisionedArtworkUrl(src, revision);
    let fallback = false;
    if (!await readyArtwork(targetPoster)) {
      // When the poster is missing, use a decoded cover, never an empty stage.
      if (!await readyArtwork(revisionedArtworkUrl(project.cover, coverRevision))) {
        if (token === versionRequestRef.current) setVersionPendingIndex(null);
        return;
      }
      fallback = true;
    }
    if (token !== versionRequestRef.current || closingRef.current || !dialogRef.current?.open) return;
    stop();
    setFallbackVersionPoster(fallback ? { projectId: project.id, versionId: next.id } : null);
    setDimensions(next.videoWidth > 0 && next.videoHeight > 0 ? { width: next.videoWidth, height: next.videoHeight } : null);
    setVersionSelection({ projectId: project.id, index: nextIndex });
    setVersionPendingIndex(null);
  };
  const focusLastControl = () => dialogRef.current?.querySelector('.cinema-player__return')?.focus();

  return createPortal(
    <dialog className={`cinema-player${motionVisible && !isClosing ? ' is-motion-visible' : ''}${isClosing ? ' is-closing' : ''}`} ref={dialogRef} aria-labelledby="cinema-player-title"
      data-project-id={project?.id}
      data-format={dimensions ? (dimensions.width >= dimensions.height ? 'landscape' : 'portrait') : undefined}
      onCancel={event => { event.preventDefault(); dismiss(); }}>
      <span className="cinema-player__focus-guard" tabIndex={0} onFocus={focusLastControl} />
      <CinemaNavigation lang={lang} closeRef={closeRef} navRef={navRef} onClose={dismiss} />
      <div className="cinema-player__layout" ref={layoutRef}>
        <div ref={bodyRef} className="cinema-player__body" style={size && videoUrl ? { width: size.width, maxWidth: '100%' } : undefined}>
          {videoUrl ? <div className="cinema-player__stage" data-playback-state={status} style={size ? { width: size.width, height: size.height } : undefined} aria-busy={status === 'loading'}>
            <video key={`video-${project.id}-${currentVersion?.id}`} ref={videoRef} poster={versionPoster} controls playsInline preload="none"
              aria-label={project.title[lang]} style={{ visibility: size && !failed ? 'visible' : 'hidden' }}
              onLoadedMetadata={event => {
                const video = event.currentTarget;
                if (video !== videoRef.current) return;
                if (!dimensions && video.videoWidth && video.videoHeight) {
                  setDimensions({ width: video.videoWidth, height: video.videoHeight });
                } else if (dimensions && Math.abs(video.videoWidth / video.videoHeight - dimensions.width / dimensions.height) > .01) {
                  console.warn(`Video dimensions for ${project.id} are stale; regenerate player media metadata.`);
                }
              }} onPlaying={event => {
                if (event.currentTarget !== videoRef.current) return;
                if (document.hidden || !dialogRef.current?.open || switchingRef.current) { event.currentTarget.pause(); return; }
                setStatus('playing'); setPlayBlocked(false);
                if (frameReadyRef.current) return;
                const video = event.currentTarget;
                const attempt = attemptRef.current;
                const reveal = () => {
                  if (video !== videoRef.current || attempt !== attemptRef.current || !video.isConnected || !dialogRef.current?.open) return;
                  frameReadyRef.current = true;
                  setStarted(true);
                };
                if (video.requestVideoFrameCallback) {
                  const callback = video.requestVideoFrameCallback(reveal);
                  cancelFrameRef.current = () => video.cancelVideoFrameCallback(callback);
                } else {
                  let callback = requestAnimationFrame(() => {
                    callback = requestAnimationFrame(() => { if (video.readyState >= 2) reveal(); });
                  });
                  cancelFrameRef.current = () => cancelAnimationFrame(callback);
                }
              }} onWaiting={event => {
                if (event.currentTarget === videoRef.current && requestedRef.current && !event.currentTarget.paused) setStatus('loading');
              }} onPause={event => {
                if (event.currentTarget === videoRef.current) setStatus(previous => previous === 'playing' ? 'paused' : previous);
              }} onEnded={event => { if (event.currentTarget === videoRef.current) setStatus('paused'); }}
              onError={event => {
                const video = event.currentTarget;
                if (video !== videoRef.current || !requestedRef.current || !video.getAttribute('src') || !video.error || video.error.code === 1) return;
                cancelFrameRef.current?.();
                setStatus('error'); setStarted(false); setPlayBlocked(false);
              }} />
            <img key={`poster-${project.id}-${currentVersion?.id}`} className={`cinema-player__poster${started ? ' is-revealed' : ''}`}
              src={versionPoster} alt=""
              onError={event => { if (event.currentTarget.getAttribute('src') !== project.cover) event.currentTarget.src = project.cover; }} />
            {(switching || versionPendingIndex !== null) && <span className="cinema-player__loading" role="status" aria-live="polite">
              {lang === 'en' ? 'Preparing next image…' : '正在准备画面…'}
            </span>}
            {status === 'loading' && !switching && versionPendingIndex === null && <span className="cinema-player__loading" role="status">{lang === 'en' ? 'Loading film…' : '影片加载中…'}</span>}
            {!failed && !playing && status !== 'loading' && !switching && versionPendingIndex === null && <div className="cinema-player__start">
              <button className="cinema-player__play" type="button" onClick={() => play()}
                aria-label={lang === 'en' ? 'Play film' : '播放影片'}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </button>
              {playBlocked && <p role="status">{lang === 'en'
                ? 'Playback was blocked. Tap play again or use the video controls.'
                : '播放未能开始，请再次点击播放或使用视频控件。'}</p>}
            </div>}
            {failed && <div className="cinema-player__message" role="status">
              <p>{lang === 'en' ? 'Unable to load this video.' : '视频暂时无法加载'}</p>
              <button type="button" onClick={retry}>{lang === 'en' ? 'Reload video' : '重新加载视频'}</button>
            </div>}
          </div> : <div className="cinema-player__pending">
            <img src={project.cover} alt={project.title[lang]} />
            <p role="status">{lang === 'en' ? 'Video pending upload' : '视频待上传'}</p>
            <span>{lang === 'en' ? 'This work is not available for playback yet.' : '该作品暂未配置可播放的视频'}</span>
          </div>}
          <div className="cinema-player__information" ref={informationRef}>
          {versions.length > 1 && <div className="cinema-player__versions" role="group" aria-label={lang === 'en' ? 'Video versions' : '视频版本切换'}>
            {versions.map((version, i) => (
              <button key={version.id} type="button" className="cinema-player__version"
                aria-pressed={i === versionIndex} aria-busy={versionPendingIndex === i}
                onPointerEnter={() => warmImage(revisionedArtworkUrl(version.playerPoster || project.cover,
                  version.playerPoster ? currentLocalArtworkRevision('poster', project.id, version.id) : coverRevision))}
                onFocus={() => warmImage(revisionedArtworkUrl(version.playerPoster || project.cover,
                  version.playerPoster ? currentLocalArtworkRevision('poster', project.id, version.id) : coverRevision))}
                onClick={() => chooseVersion(i)}>
                {version.label?.[lang] || (lang === 'en' ? `Version ${i + 1}` : `版本 ${i + 1}`)}
              </button>
            ))}
          </div>}
          <div className="cinema-player__caption">
            <h2 id="cinema-player-title">{project.title[lang]}</h2>
            {secondaryLabel && <p>{secondaryLabel}</p>}
          </div>
          <div className="cinema-player__work-nav" role="group" aria-busy={switching} aria-label={lang === 'en' ? 'Work navigation' : '作品切换'}>
            <div className="cinema-player__sequence">
              <button type="button" onClick={() => switchWork(index-1)} disabled={switching || index <= 0}
                onPointerEnter={() => warmImage(initialProjectPoster(projects[index-1]))}
                onFocus={() => warmImage(initialProjectPoster(projects[index-1]))}
                aria-label={lang==='en'?'Previous work':'上一部'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button>
              <span className="cinema-player__count" aria-live="polite">{index+1} / {projects.length}</span>
              <button type="button" onClick={() => switchWork(index+1)} disabled={switching || index < 0 || index >= projects.length-1}
                onPointerEnter={() => warmImage(initialProjectPoster(projects[index+1]))}
                onFocus={() => warmImage(initialProjectPoster(projects[index+1]))}
                aria-label={lang==='en'?'Next work':'下一部'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button>
            </div>
          </div>
            {context === 'library' ? (
              <button type="button" className="cinema-player__return" onClick={dismiss}>
                <span>{lang === 'en' ? 'View all work' : '查看全部作品'}</span>
              </button>
            ) : (
              <a className="cinema-player__return" href={WORKS_HREF}>
                <span>{lang === 'en' ? 'View all work' : '查看全部作品'}</span>
              </a>
            )}
          </div>
        </div>
      </div>
      <span className="cinema-player__focus-guard" tabIndex={0} onFocus={() => dialogRef.current?.querySelector('.cinema-player__language button')?.focus()} />
    </dialog>, document.body
  );
}
