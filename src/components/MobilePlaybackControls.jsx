import { useEffect, useRef, useState } from 'react';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

// Mobile-only controls. The source, playback lifecycle and poster transitions
// remain owned by CinemaPlayer; the native controls stay available on desktop
// and inside iPhone Safari's system-managed video fullscreen surface.
export default function MobilePlaybackControls({ videoRef, lang, playing, started, busy, failed, onTogglePlayback, onFullscreen, fullscreenUnavailable, videoDuration }) {
  const [media, setMedia] = useState({currentTime:0, duration:0, muted:false, rate:1});
  const [rateOpen, setRateOpen] = useState(false);
  const rateMenuRef = useRef(null);
  const rateTriggerRef = useRef(null);
  const rateItemsRef = useRef([]);
  const rates = [1, 1.25, 1.5, 2];

  useEffect(() => {
    if (!rateOpen) return undefined;
    const current = rates.indexOf(media.rate);
    rateItemsRef.current[Math.max(current, 0)]?.focus({preventScroll:true});
    const outside = event => {
      // The floating pill is centered on the entire media bar rather than on
      // the trigger; both remain inside the same interaction boundary.
      if (!rateMenuRef.current?.contains(event.target) && !rateTriggerRef.current?.contains(event.target))
        setRateOpen(false);
    };
    const escape = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setRateOpen(false);
        rateTriggerRef.current?.focus({preventScroll:true});
      }
    };
    const scroll = event => {
      if (!rateMenuRef.current?.contains(event.target) && !rateTriggerRef.current?.contains(event.target))
        setRateOpen(false);
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape,true);
    document.addEventListener('scroll',scroll,true);
    return () => {
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape,true);
      document.removeEventListener('scroll',scroll,true);
    };
  }, [rateOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const sync = () => {
      setMedia(previous => {
        const next = {
          currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
          muted: video.muted || video.volume === 0,
          rate: video.playbackRate || 1,
        };
        return Object.keys(next).every(key => next[key] === previous[key]) ? previous : next;
      });
    };
    const events = ['timeupdate','loadedmetadata','durationchange','seeking','seeked','volumechange','ratechange','emptied'];
    for (const event of events) video.addEventListener(event, sync);
    sync();
    return () => {for (const event of events) video.removeEventListener(event, sync);};
  }, [videoRef]);

  // Duration comes from local ffprobe metadata until playback begins.
  // Do not enable seeking until the video itself has loaded real metadata.
  const displayDuration = media.duration > 0 ? media.duration : videoDuration;
  const canSeek = media.duration > 0 && !failed && !busy;
  const progress = canSeek ? Math.min(100, Math.max(0, media.currentTime / media.duration * 100)) : 0;
  const seek = event => {
    const video = videoRef.current;
    if (!video || !canSeek) return;
    const next = Math.max(0, Math.min(media.duration, Number(event.target.value)));
    if (Number.isFinite(next)) {
      video.currentTime = next;
      setMedia(previous=>({...previous,currentTime:next}));
    }
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  };
  const chooseRate = rate => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setMedia(previous=>({...previous,rate}));
    setRateOpen(false);
    rateTriggerRef.current?.focus({preventScroll:true});
  };
  const onRateKeys = event => {
    if (event.key === 'Tab') { setRateOpen(false); return; }
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const current = rateItemsRef.current.findIndex(item => item === document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? rates.length-1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + rates.length) % rates.length;
    rateItemsRef.current[next]?.focus({preventScroll:true});
  };
  return <div className={`cinema-player__mobile-controls${started ? ' is-started' : ''}`} role="group"
    aria-label={lang === 'en' ? 'Video controls' : '视频播放控制'}>
    <input className="cinema-player__seek" type="range" min="0" max={media.duration || 1}
      step="0.1" value={Math.min(media.currentTime, media.duration || 1)}
      style={{ '--seek-progress': `${progress}%` }} onChange={seek} disabled={!canSeek}
      aria-label={lang === 'en' ? 'Playback progress' : '播放进度'} />
    <div className="cinema-player__mobile-control-row">
      <button type="button" className="cinema-player__mobile-icon cinema-player__mobile-play" onClick={onTogglePlayback}
        disabled={busy || failed} aria-label={lang === 'en' ? (playing ? 'Pause video' : 'Play video') : (playing ? '暂停视频' : '播放视频')}>
        {playing ? <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>}
      </button>
      <span className="cinema-player__mobile-time" aria-live="off">{formatTime(media.currentTime)} / {formatTime(displayDuration)}</span>
      <span className="cinema-player__mobile-spacer" />
      <button type="button" className="cinema-player__mobile-icon" onClick={toggleMute}
        aria-label={lang === 'en' ? (media.muted ? 'Unmute' : 'Mute') : (media.muted ? '取消静音' : '静音')}>
        {media.muted ? <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" /></svg>}
      </button>
      <div className="cinema-player__mobile-rate">
        <button ref={rateTriggerRef} type="button" className="cinema-player__mobile-rate-trigger"
          aria-label={lang === 'en' ? 'Playback speed' : '播放倍速'}
          aria-haspopup="menu" aria-expanded={rateOpen}
          onClick={() => setRateOpen(open => !open)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setRateOpen(true);
            }
          }}>{media.rate}×</button>
      </div>
      <button type="button" className="cinema-player__fullscreen-action cinema-player__mobile-icon"
        aria-label={lang === 'en' ? 'Watch fullscreen' : '全屏观看'}
        onClick={onFullscreen} disabled={busy || failed}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
        </svg>
      </button>
    </div>
    {rateOpen && <div ref={rateMenuRef} className="cinema-player__mobile-rate-menu" role="menu"
      aria-label={lang === 'en' ? 'Playback speed' : '播放倍速'} onKeyDown={onRateKeys}>
      {rates.map((rate,index) => <button key={rate} type="button"
        ref={element => {rateItemsRef.current[index]=element;}}
        role="menuitemradio" aria-checked={media.rate === rate}
        className={`cinema-player__mobile-rate-option${media.rate===rate ? ' is-selected' : ''}`}
        onClick={() => chooseRate(rate)}>{rate}×</button>)}
    </div>}
    {fullscreenUnavailable && <p className="cinema-player__fullscreen-hint" role="status">
      {lang === 'en' ? 'If fullscreen is unavailable, use the browser video controls.' : '无法进入全屏时，可尝试浏览器自带的视频全屏控件。'}
    </p>}
  </div>;
}
