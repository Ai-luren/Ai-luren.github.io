import './ImpactEvidence.css';
import LogoLoop from './LogoLoop.jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n/index.js';

import hailuoLogo from '../../assets/images/platform-logos/hailuo-color.webp';
import jimengLogo from '../../assets/images/platform-logos/jimeng-color.webp';
import klingLogo from '../../assets/images/platform-logos/kling-color.webp';
import midjourneyLogo from '../../assets/images/platform-logos/midjourney.webp';
import pixverseLogo from '../../assets/images/platform-logos/pixverse-color.webp';
import polloLogo from '../../assets/images/platform-logos/Pollo.webp';
import qwenLogo from '../../assets/images/platform-logos/qwen-color.webp';
import viduLogo from '../../assets/images/platform-logos/vidu-color.webp';

import award1 from '../../assets/images/awards/hailuo.webp';
import award2 from '../../assets/images/awards/pollo.webp';
import award3 from '../../assets/images/awards/liantong.webp';
import award4 from '../../assets/images/awards/meitu.webp';
import award5 from '../../assets/images/awards/Lenovo.webp';
import award7 from '../../assets/images/awards/mj.webp';
import award8 from '../../assets/images/awards/kling.webp';
import award9 from '../../assets/images/awards/liantong2.webp';
import douyinScreenshot from '../../assets/images/social-profiles/抖音主页.webp';
import xiaohongshuScreenshot from '../../assets/images/social-profiles/小红书主页.webp';
import kuaishouScreenshot from '../../assets/images/social-profiles/快手主页.webp';
import wechatChannelScreenshot from '../../assets/images/social-profiles/视频号主页.webp';
import wechatChannelQrCode from '../../assets/images/social-profiles/视频号二维码.webp';
import wechatQrCode from '../../assets/images/social-profiles/微信二维码.webp';
import douyinQrCode from '../../assets/images/social-profiles/抖音二维码.webp';
import xiaohongshuQrCode from '../../assets/images/social-profiles/小红书二维码.webp';
import kuaishouQrCode from '../../assets/images/social-profiles/快手二维码.webp';

const awards = [
  { image: award1, title: { zh: '海螺AI动物跳水', en: 'Hailuo AI Animal Diving' }, meta: { zh: '登陆LED大屏', en: 'Displayed on LED Screen' } },
  { image: award2, title: { zh: '影视级特效小赛', en: 'Cinematic Effects Contest' }, meta: { zh: 'Pollo.ai / 优秀奖', en: 'Pollo.ai / Excellence Award' } },
  { image: award3, title: { zh: '海纳星火计划', en: 'Spark of Haina Program' }, meta: { zh: '中国联通 / 三等奖', en: 'China Unicom / 3rd Prize' } },
  { image: award4, title: { zh: '未来AI设计大赛', en: 'Future AI Design Contest' }, meta: { zh: '美图 / 年度入围', en: 'Meitu / Annual Finalist' } },
  { image: award5, title: { zh: '联想AI比赛', en: 'Lenovo AI Competition' }, meta: { zh: '创作先锋奖 / 官号精选', en: 'Creative Pioneer / Official Selection' } },
  { image: award7, title: { zh: 'MJ 官方优秀作品', en: 'Midjourney Official Featured' }, meta: { zh: 'Midjourney / 官方精选', en: 'Midjourney / Official Selection' } },
  { image: award8, title: { zh: '无限剧场小赛', en: 'Infinite Theater Contest' }, meta: { zh: '可灵AI / 超棒奖', en: 'Kling AI / Awesome Award' } },
  { image: award9, title: { zh: '海纳星火计划', en: 'Spark of Haina Program' }, meta: { zh: '中国联通 / 三等奖', en: 'China Unicom / 3rd Prize' } },
];

const creatorLogos = [
  { src: klingLogo, width: 640, height: 640, alt: { zh: '可灵 AI', en: 'Kling AI' }, title: { zh: '可灵 AI', en: 'Kling AI' }, role: { zh: '优质创作者', en: 'Premium Creator' } },
  { src: jimengLogo, width: 640, height: 640, alt: { zh: '即梦 AI', en: 'Jimeng AI' }, title: { zh: '即梦 AI', en: 'Jimeng AI' }, role: { zh: '成长创作者', en: 'Rising Creator' } },
  { src: hailuoLogo, width: 640, height: 640, alt: { zh: '海螺 AI', en: 'Hailuo AI' }, title: { zh: '海螺 AI', en: 'Hailuo AI' }, role: { zh: '超级创作者', en: 'Super Creator' } },
  { src: viduLogo, width: 640, height: 640, alt: { zh: 'Vidu AI', en: 'Vidu AI' }, title: { zh: 'Vidu AI', en: 'Vidu AI' }, role: { zh: '艺术家', en: 'AI Artist' } },
  { src: pixverseLogo, width: 640, height: 640, alt: { zh: '拍我 AI', en: 'Paiwo AI' }, title: { zh: '拍我 AI', en: 'Paiwo AI' }, role: { zh: '超级创作者', en: 'Super Creator' } },
  { src: polloLogo, width: 446, height: 418, alt: { zh: 'Pollo AI', en: 'Pollo AI' }, title: { zh: 'Pollo AI', en: 'Pollo AI' }, role: { zh: '优秀创作者', en: 'Outstanding Creator' } },
  { src: midjourneyLogo, width: 640, height: 640, alt: { zh: 'Midjourney', en: 'Midjourney' }, title: { zh: 'Midjourney', en: 'Midjourney' }, role: { zh: '官方精选', en: 'Official Featured' }, className: 'logo-loop__image--light' },
  { src: qwenLogo, width: 640, height: 640, alt: { zh: '通义 Wan', en: 'Tongyi Wan' }, title: { zh: '通义 Wan', en: 'Tongyi Wan' }, role: { zh: '官方创作者', en: 'Official Creator' } },
];

const reachCards = [
  {
    id: 'douyin',
    platform: { zh: '抖音', en: 'TikTok' },
    screenshot: douyinScreenshot,
    stats: { zh: '1.7w粉丝 144.6w赞', en: '17K followers · 1.45M likes' },
    link: 'https://v.douyin.com/idVkRoxL/',
    hoverLabel: { zh: '跳转 ↗', en: 'JUMP ↗' },
    qrNote: { zh: '使用 抖音 扫码访问 @Ai路人 主页', en: 'Scan with TikTok to visit @Ai路人 profile' },
    qrCode: douyinQrCode,
  },
  {
    id: 'xiaohongshu',
    platform: { zh: '小红书', en: 'Rednote' },
    screenshot: xiaohongshuScreenshot,
    stats: { zh: '3494粉丝 5.6w赞', en: '3.5K followers · 56K likes' },
    link: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470',
    hoverLabel: { zh: '跳转 ↗', en: 'JUMP ↗' },
    qrNote: { zh: '使用 微信/小红书 扫码访问 @Ai路人 主页', en: 'Scan with WeChat or Rednote to visit @Ai路人 profile' },
    qrCode: xiaohongshuQrCode,
  },
  {
    id: 'kuaishou',
    platform: { zh: '快手', en: 'Kuaishou' },
    screenshot: kuaishouScreenshot,
    stats: { zh: '4475粉丝 9938赞', en: '4.5K followers · 9.9K likes' },
    link: 'https://v.kuaishou.com/K75e2i3A',
    hoverLabel: { zh: '跳转 ↗', en: 'JUMP ↗' },
    qrNote: { zh: '使用 微信/快手 扫码访问 @Ai路人 主页', en: 'Scan with WeChat or Kuaishou to visit @Ai路人 profile' },
    qrCode: kuaishouQrCode,
  },
  {
    id: 'wechat-channel',
    platform: { zh: '视频号', en: 'WeChat Channels' },
    screenshot: wechatChannelScreenshot,
    stats: { zh: '9087赞 4237喜爱', en: '9.1K likes · 4.2K favorites' },
    hoverLabel: { zh: '跳转 ↗', en: 'JUMP ↗' },
    qrNote: { zh: '使用 微信 扫码访问 @Ai路人- 主页', en: 'Scan with WeChat to visit @Ai路人- profile' },
    qrCode: wechatChannelQrCode,
  },
];

function useNearViewport(rootMargin = '500px') {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!('IntersectionObserver' in window)) {
      setReady(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);
  return [ref, ready];
}

function ImpactLabel({ id, index, title }) {
  return (
    <div className="impact-evidence-label">
      <span className="impact-eyebrow">{index.split(' / ')[0]}</span>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function AwardGallery() {
  const lang = useLang();
  const [openIndex, setOpenIndex] = useState(-1);
  const [isClosing, setIsClosing] = useState(false);
  const [railState, setRailState] = useState({ canScrollLeft: false, canScrollRight: true });
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  ));
  const [mobileAwardIndex, setMobileAwardIndex] = useState(0);
  const railRef = useRef(null);
  const awardTouchState = useRef({ startX: 0, startY: 0, moved: false, axis: 'none', suppressClickUntil: 0 });
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const closeTimerRef = useRef(null);
  const closingRef = useRef(false);
  const isOpen = openIndex >= 0;

  const open = useCallback((index, event) => {
    triggerRef.current = event.currentTarget;
    window.clearTimeout(closeTimerRef.current);
    closingRef.current = false;
    setIsClosing(false);
    setOpenIndex(index);
  }, []);
  const close = useCallback(() => {
    if (!isOpen || closingRef.current) return;
    closingRef.current = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setOpenIndex(-1);
      setIsClosing(false);
      closingRef.current = false;
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpenIndex(-1);
      setIsClosing(false);
      closingRef.current = false;
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }, 240);
  }, [isOpen]);
  const step = useCallback((delta) => {
    setOpenIndex((index) => (index < 0 ? index : (index + delta + awards.length) % awards.length));
  }, []);
  const syncRail = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (isMobile) {
      setRailState({ canScrollLeft: mobileAwardIndex > 0, canScrollRight: mobileAwardIndex < awards.length - 1 });
      return;
    }
    setRailState({
      canScrollLeft: rail.scrollLeft > 2,
      canScrollRight: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
    });
  }, [isMobile, mobileAwardIndex]);

  const moveToMobileAward = useCallback((index) => {
    const safeIndex = Math.max(0, Math.min(awards.length - 1, index));
    setMobileAwardIndex(safeIndex);
    setRailState({ canScrollLeft: safeIndex > 0, canScrollRight: safeIndex < awards.length - 1 });
  }, []);

  const setRailTouchOffset = (offset, dragging) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.classList.toggle('is-touch-dragging', dragging);
    rail.style.setProperty('--mobile-swipe-x', `${offset}px`);
  };

  const scrollRail = useCallback((direction) => {
    const rail = railRef.current;
    if (!rail) return;
    if (isMobile) {
      moveToMobileAward(mobileAwardIndex + direction);
      return;
    }
    rail.scrollBy({ left: direction * rail.clientWidth * .82, behavior: 'smooth' });
  }, [isMobile, mobileAwardIndex, moveToMobileAward]);

  const handleRailTouchStart = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    awardTouchState.current = { startX: touch.clientX, startY: touch.clientY, moved: false, axis: 'none', suppressClickUntil: 0 };
  };

  const handleRailTouchMove = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - awardTouchState.current.startX;
    const dy = touch.clientY - awardTouchState.current.startY;
    const distanceX = Math.abs(dx);
    const distanceY = Math.abs(dy);
    if (distanceX > 10 || distanceY > 10) {
      awardTouchState.current.moved = true;
      if (awardTouchState.current.axis === 'none') {
        awardTouchState.current.axis = distanceX > distanceY ? 'horizontal' : 'vertical';
      }
    }
    if (awardTouchState.current.axis === 'horizontal') {
      const atBoundary = (mobileAwardIndex === 0 && dx > 0)
        || (mobileAwardIndex === awards.length - 1 && dx < 0);
      setRailTouchOffset(atBoundary ? dx * .35 : dx, true);
    }
  };

  const handleRailTouchEnd = (event) => {
    if (!isMobile) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const distanceX = touch.clientX - awardTouchState.current.startX;
    const distanceY = touch.clientY - awardTouchState.current.startY;
    const isHorizontalSwipe = awardTouchState.current.axis === 'horizontal'
      && Math.abs(distanceX) > 42
      && Math.abs(distanceX) > Math.abs(distanceY);
    if (isHorizontalSwipe) {
      awardTouchState.current.suppressClickUntil = Date.now() + 450;
      setRailTouchOffset(0, false);
      scrollRail(distanceX < 0 ? 1 : -1);
    } else if (awardTouchState.current.moved) {
      awardTouchState.current.suppressClickUntil = Date.now() + 250;
      setRailTouchOffset(0, false);
    }
  };

  const handleRailTouchCancel = () => {
    setRailTouchOffset(0, false);
    awardTouchState.current = { startX: 0, startY: 0, moved: false, axis: 'none', suppressClickUntil: 0 };
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    syncRail();
    rail.addEventListener('scroll', syncRail, { passive: true });
    window.addEventListener('resize', syncRail);
    return () => {
      rail.removeEventListener('scroll', syncRail);
      window.removeEventListener('resize', syncRail);
    };
  }, [syncRail]);

  useEffect(() => {
    return () => window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    };
  }, [isOpen, close, step]);

  const active = isOpen ? awards[openIndex] : null;
  const galleryHint = lang === 'en'
    ? (isMobile ? 'BROWSE WITH ARROWS' : 'BROWSE WITH ARROWS · CLICK TO VIEW')
    : (isMobile ? '左右浏览 · 选择作品' : '左右浏览 · 点击查看');

  return (
    <div className="impact-glass impact-award-shell" onTouchStart={handleRailTouchStart} onTouchMove={handleRailTouchMove} onTouchEnd={handleRailTouchEnd} onTouchCancel={handleRailTouchCancel}>
      <div id="impact-award-gallery-note" className="impact-evidence-note"><span>{lang === 'en' ? 'AWARD CERTIFICATES' : '获奖截图'}</span><span>{galleryHint}</span></div>
      <p className="impact-award-description">{lang === 'en' ? 'AI creation contests with wins and finalists.' : '参与 AI 创作赛事，含获奖和入围作品。'}</p>
      <button
        type="button"
        className="impact-award-rail-nav impact-award-rail-nav--prev"
        aria-label={lang === 'en' ? 'Scroll awards left' : '向左浏览获奖作品'}
        aria-controls="impact-award-rail"
        disabled={!railState.canScrollLeft}
        onClick={() => scrollRail(-1)}
      >
        <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 5-7 7 7 7" /></svg>
      </button>
      <button
        type="button"
        className="impact-award-rail-nav impact-award-rail-nav--next"
        aria-label={lang === 'en' ? 'Scroll awards right' : '向右浏览获奖作品'}
        aria-controls="impact-award-rail"
        disabled={!railState.canScrollRight}
        onClick={() => scrollRail(1)}
      >
        <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8.5 5 7 7-7 7" /></svg>
      </button>
      <ul id="impact-award-rail" ref={railRef} className="impact-award-rail" aria-label={lang === 'en' ? 'Award artwork' : '获奖作品图片'} aria-describedby="impact-award-gallery-note" aria-live={isMobile ? 'polite' : 'off'} tabIndex={0}>
        {(isMobile ? [awards[mobileAwardIndex]] : awards).map((award, visibleIndex) => {
          const index = isMobile ? mobileAwardIndex : visibleIndex;
          return (
          <li key={award.image}>
            <button
              type="button"
              className="impact-award-card"
              aria-label={lang === 'en' ? `Zoom in: ${award.title.en}, ${award.meta.en}` : `放大查看：${award.title.zh}，${award.meta.zh}`}
              aria-haspopup="dialog"
              aria-controls="impact-award-lightbox"
              onClick={(event) => {
                if (awardTouchState.current.moved || Date.now() < awardTouchState.current.suppressClickUntil) {
                  event.preventDefault();
                  handleRailTouchCancel();
                  return;
                }
                open(index, event);
              }}
            >
              <img src={award.image} alt={award.title[lang]} width="1124" height="2000" loading={index < 4 ? 'eager' : 'lazy'} decoding="async" onLoad={syncRail} />
              <span className="impact-award-card-caption" aria-hidden="true">
                <strong>{award.title[lang]}</strong>
                <small>{award.meta[lang]}</small>
              </span>
            </button>
          </li>
          );
        })}
      </ul>
      <div className="impact-award-pagination" role="tablist" aria-label={lang === 'en' ? 'Select an award' : '选择获奖作品'}>
        {awards.map((award, index) => (
          <button
            key={award.image}
            type="button"
            role="tab"
            aria-controls="impact-award-rail"
            aria-selected={mobileAwardIndex === index}
            aria-label={lang === 'en' ? `Show ${award.title.en}` : `查看${award.title.zh}`}
            className={mobileAwardIndex === index ? 'is-active' : ''}
            onClick={() => moveToMobileAward(index)}
          />
        ))}
      </div>
      {/* 预览通过 Portal 独立于玻璃壳，避免 backdrop-filter 改变 fixed 定位；作为可退出的全屏模态层。 */}
      {active && createPortal(
        <div
          id="impact-award-lightbox"
          ref={dialogRef}
          className={`impact-award-lightbox${isClosing ? ' is-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="impact-award-lightbox-title"
          aria-describedby="impact-award-lightbox-meta"
          tabIndex={-1}
        >
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={active.image} alt={active.title[lang]} width="1124" height="2000" />
            <figcaption aria-live="polite">
              <strong id="impact-award-lightbox-title">{active.title[lang]}</strong>
              <span id="impact-award-lightbox-meta">{active.meta[lang]}</span>
            </figcaption>
            <button type="button" className="impact-award-lightbox-nav impact-award-lightbox-nav--prev" aria-label={lang === 'en' ? 'Previous award' : '上一张'} aria-controls="impact-award-lightbox" onClick={() => step(-1)}>
              <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5-7 7 7 7" /></svg>
            </button>
            <button type="button" className="impact-award-lightbox-nav impact-award-lightbox-nav--next" aria-label={lang === 'en' ? 'Next award' : '下一张'} aria-controls="impact-award-lightbox" onClick={() => step(1)}>
              <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m10 5 7 7-7 7" /></svg>
            </button>
          </figure>
          <button type="button" className="impact-award-lightbox-close" aria-label={lang === 'en' ? 'Close preview' : '关闭预览'} aria-controls="impact-award-lightbox" onClick={close}>✕</button>
        </div>,
        document.body
      )}
    </div>
  );
}

function LogoIndex() {
  const [logoRef, ready] = useNearViewport('500px');
  const lang = useLang();
  const logos = useMemo(() => creatorLogos.map((logo) => ({
    ...logo,
    alt: typeof logo.alt === 'string' ? logo.alt : logo.alt[lang],
    title: typeof logo.title === 'string' ? logo.title : logo.title[lang],
  })), [lang]);
  return (
    <div ref={logoRef} className="impact-glass impact-logo-shell">
      <div className="impact-logo-head"><span>{lang === 'en' ? 'CREATOR PLATFORMS' : '创作平台'}</span><span>{lang === 'en' ? 'SUPER CREATORS' : '超级创作者'}</span></div>
      {ready && <LogoLoop
        logos={logos}
        speed={0}
        logoHeight={40}
        gap={48}
        hoverSpeed={0}
        motionEnabled={false}
        ariaLabel={lang === 'en' ? 'Creator platform logos' : '创作者平台 Logo'}
      />}
      <div className="impact-platform-desktop-card">
        <div className="impact-platform-desktop-head">
          <span>{lang === 'en' ? 'CREATOR PLATFORMS' : '创作平台'}</span>
          <span>{lang === 'en' ? 'CREATOR PARTNER' : '合作创作者'}</span>
        </div>
        <p className="impact-platform-desktop-description">{lang === 'en' ? 'Creator partner across multiple AI video platforms.' : '多个 AI 视频平台的合作创作者。'}</p>
        <div className="impact-platform-desktop-grid">
          {logos.map((logo) => (
            <div className="impact-platform-desktop-tile" key={`desktop-${logo.title}`}>
              <img src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} loading="lazy" decoding="async" className={logo.className || ''} />
              <div><strong>{logo.title}</strong><span>{logo.role[lang]}</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="impact-platform-mobile-card">
        <div className="impact-platform-mobile-manifesto">
          <div className="impact-platform-mobile-meta"><span>{lang === 'en' ? 'CREATOR PLATFORMS' : '创作平台'}</span><span>{lang === 'en' ? 'CREATOR PARTNER' : '合作创作者'}</span></div>
          <h3>{lang === 'en' ? 'AI VIDEO CREATOR' : 'AI 视频创作者'}</h3>
          <p>{lang === 'en'
            ? 'Creator partner across multiple AI video platforms.'
            : '多个 AI 视频平台的合作创作者。'}</p>
          <div className="impact-platform-mobile-signature">{lang === 'en' ? 'CREATOR PARTNER · MULTI-PLATFORM' : '合作创作者 · 多平台创作'}</div>
        </div>
        <div className="impact-platform-mobile-network">
          <div className="impact-platform-mobile-network-head">{lang === 'en' ? 'CREATOR PLATFORMS / CREDENTIALS' : '创作平台 / 创作者身份'}</div>
          <div className="impact-platform-mobile-grid">
            {logos.map((logo) => (
              <div className="impact-platform-mobile-tile" key={logo.title}>
                <img src={logo.src} alt={logo.alt} className={logo.className || ''} width={logo.width} height={logo.height} loading="lazy" decoding="async" />
                <div><strong>{logo.title}</strong><span>{logo.role[lang]}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReachDossier() {
  const lang = useLang();
  const [activeQr, setActiveQr] = useState(null);
  const [isQrClosing, setIsQrClosing] = useState(false);
  const qrDialogRef = useRef(null);
  const qrTriggerRef = useRef(null);
  const qrCloseTimerRef = useRef(null);
  const qrClosingRef = useRef(false);

  const closeQr = useCallback(() => {
    if (!activeQr || qrClosingRef.current) return;
    qrClosingRef.current = true;
    const finish = () => {
      setActiveQr(null);
      setIsQrClosing(false);
      qrClosingRef.current = false;
      requestAnimationFrame(() => qrTriggerRef.current?.focus({ preventScroll: true }));
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    setIsQrClosing(true);
    qrCloseTimerRef.current = window.setTimeout(finish, 240);
  }, [activeQr]);

  useEffect(() => () => window.clearTimeout(qrCloseTimerRef.current), []);

  useEffect(() => {
    if (!activeQr) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeQr();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => qrDialogRef.current?.focus({ preventScroll: true }));
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeQr, closeQr]);

  return (
    <div className="impact-glass impact-reach-dossier">
      <div className="impact-reach-dossier-head">
        <span>{lang === 'en' ? 'CONTENT REACH' : '多平台分享 AI 内容'}</span>
        {lang === 'en' && <span>AI SOCIAL MEDIA</span>}
      </div>
      <p className="impact-reach-dossier-description">{lang === 'en' ? 'AI content shared across TikTok, Rednote, Kuaishou, and WeChat Channels.' : '抖音、小红书、快手、视频号均有 AI 内容分享。'}</p>
      <div className="impact-reach-profile-grid">
        {reachCards.map((card) => {
          const hasLink = !!card.link;
          const hasQr = !!card.qrCode;
          const Tag = hasLink ? 'a' : 'div';
          const hoverLabel = card.hoverLabel?.[lang];
          const tagProps = hasLink
            ? { href: card.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': lang === 'en' ? `Visit ${card.platform.en} profile` : `访问${card.platform.zh}主页` }
            : {};
          const shotClass = `impact-reach-profile-shot${hasLink ? ' impact-reach-profile-shot--link' : ''}`;
          return (
            <article className="impact-reach-profile" key={card.id}>
              <Tag className={shotClass} {...tagProps}>
                <div className="impact-reach-profile-media">
                  <img src={card.screenshot} alt={lang === 'en' ? `${card.platform.en} profile screenshot` : `${card.platform.zh} 主页截图`} width="1179" height="938" loading="lazy" decoding="async" />
                  {hoverLabel && <span className="impact-reach-profile-hover-label" aria-hidden="true">{hoverLabel}</span>}
                </div>
                {hoverLabel && <span className="impact-reach-mobile-link" aria-hidden="true">{lang === 'en' ? 'Visit ↗' : '跳转 ↗'}</span>}
              </Tag>
              <div className="impact-reach-profile-caption"><strong>{card.platform[lang]}</strong><span>{card.stats[lang]}</span></div>
              <div className="impact-reach-profile-actions">
                {hasQr && (
                  <button
                    type="button"
                    className="impact-reach-profile-qr"
                    aria-haspopup="dialog"
                    aria-label={lang === 'en' ? `View ${card.platform.en} QR code` : `查看${card.platform.zh}二维码`}
                    onClick={(event) => {
                      qrTriggerRef.current = event.currentTarget;
                      window.clearTimeout(qrCloseTimerRef.current);
                      qrClosingRef.current = false;
                      setIsQrClosing(false);
                      setActiveQr(card);
                    }}
                  >
                    <svg className="impact-qr-icon" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 2.5h5v5h-5zM10.5 2.5h5v5h-5zM2.5 10.5h5v5h-5z" />
                      <path d="M12 11v2M10.5 15.5h2M15.5 11v4.5h-2M10.5 9.5h5" />
                    </svg>
                    {lang === 'en' ? 'VIEW QR' : '查看二维码'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {activeQr && createPortal(
        <div className={`impact-qr-lightbox${isQrClosing ? ' is-closing' : ''}`} role="presentation" onClick={closeQr}>
          <div
            ref={qrDialogRef}
            className="impact-qr-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="impact-qr-dialog-title"
            aria-describedby="impact-qr-dialog-note"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="impact-qr-dialog-close" aria-label={lang === 'en' ? 'Close QR code' : '关闭二维码'} onClick={closeQr}>×</button>
            <p className="impact-qr-dialog-kicker">{lang === 'en' ? 'SOCIAL PROFILE' : '自媒体主页'}</p>
            <h3 id="impact-qr-dialog-title">{activeQr.platform[lang]}</h3>
            <img src={activeQr.qrCode} alt={lang === 'en' ? `${activeQr.platform.en} QR code` : `${activeQr.platform.zh}二维码`} width="630" height="632" />
            <p id="impact-qr-dialog-note">{activeQr.qrNote[lang]}</p>
            <div className="impact-qr-dialog-actions">
              <a href={activeQr.qrCode} download={`${activeQr.id}-qr-code.webp`}>
                {lang === 'en' ? 'SAVE QR' : '保存二维码'}
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ImpactEvidence() {
  const lang = useLang();
  const initialImpactId = typeof window !== 'undefined' && ['impact-awards', 'impact-programs', 'impact-reach'].includes(window.location.hash.slice(1))
    ? window.location.hash.slice(1)
    : 'impact-awards';
  const [activeImpactId, setActiveImpactId] = useState(initialImpactId);
  const [impactNavigationVersion, setImpactNavigationVersion] = useState(0);
  const shouldAlignRef = useRef(initialImpactId !== 'impact-awards' || (typeof window !== 'undefined' && window.location.hash === '#impact-awards'));

  useEffect(() => {
    const onNavigate = (event) => {
      const nextId = event.detail;
      if (!['impact-awards', 'impact-programs', 'impact-reach'].includes(nextId)) return;
      shouldAlignRef.current = true;
      setActiveImpactId(nextId);
      setImpactNavigationVersion((version) => version + 1);
    };
    const onHistory = () => {
      const nextId = window.location.hash.slice(1);
      if (!['impact-awards', 'impact-programs', 'impact-reach'].includes(nextId)) return;
      shouldAlignRef.current = true;
      setActiveImpactId(nextId);
      setImpactNavigationVersion((version) => version + 1);
    };
    window.addEventListener('portfolio:navigate', onNavigate);
    window.addEventListener('hashchange', onHistory);
    window.addEventListener('popstate', onHistory);
    return () => {
      window.removeEventListener('portfolio:navigate', onNavigate);
      window.removeEventListener('hashchange', onHistory);
      window.removeEventListener('popstate', onHistory);
    };
  }, []);

  useEffect(() => {
    if (!shouldAlignRef.current || window.matchMedia?.('(max-width: 760px)').matches) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(activeImpactId);
      const header = document.querySelector('header');
      if (!target) return;
      const offset = (header?.getBoundingClientRect().bottom || 0) + 34;
      window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset), behavior: 'smooth' });
      shouldAlignRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeImpactId, impactNavigationVersion]);

  return (
    <div className="impact-evidence">
      <section id="impact-awards" className={`impact-evidence-row${activeImpactId === 'impact-awards' ? ' is-desktop-active' : ''}`} aria-labelledby="impact-awards-heading">
        <ImpactLabel id="impact-awards-heading" index="01 / AI AWARDED WORKS" title={lang === 'en' ? 'AI Awarded Works' : 'AI 获奖作品'} />
        <div><AwardGallery /></div>
      </section>
      <section id="impact-programs" className={`impact-evidence-row${activeImpactId === 'impact-programs' ? ' is-desktop-active' : ''}`} aria-labelledby="impact-programs-heading">
        <ImpactLabel id="impact-programs-heading" index="02 / AI PLATFORM CREATOR" title={lang === 'en' ? 'AI Platform Creator' : 'AI 平台超创'} />
        <div><LogoIndex /></div>
      </section>
      <section id="impact-reach" className={`impact-evidence-row${activeImpactId === 'impact-reach' ? ' is-desktop-active' : ''}`} aria-labelledby="impact-reach-heading">
        <ImpactLabel id="impact-reach-heading" index="03 / AI MEDIA" title={lang === 'en' ? 'AI Media' : 'AI 自媒体'} />
        <div><ReachDossier /></div>
      </section>
    </div>
  );
}
