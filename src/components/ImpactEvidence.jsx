import './ImpactEvidence.css';
import LogoLoop from './LogoLoop.jsx';
import CinemaNavigation from './CinemaNavigation.jsx';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang, useT } from '../i18n/index.js';

import hailuoLogo from '../../assets/images/platform-logos/hailuo-color.webp';
import jimengLogo from '../../assets/images/platform-logos/jimeng-color.webp';
import klingLogo from '../../assets/images/platform-logos/kling-color.webp';
import midjourneyLogo from '../../assets/images/platform-logos/midjourney.webp';
import pixverseLogo from '../../assets/images/platform-logos/pixverse-color.webp';
import polloLogo from '../../assets/images/platform-logos/Pollo.webp';
import qwenLogo from '../../assets/images/platform-logos/qwen-color.webp';
import viduLogo from '../../assets/images/platform-logos/vidu-color.webp';

import award1 from '../../assets/images/awards/海螺AI动物跳水.webp';
import award2 from '../../assets/images/awards/影视级特效小赛.webp';
import award3 from '../../assets/images/awards/海纳星火计划-小人国制作奶茶.webp';
import award4 from '../../assets/images/awards/未来AI设计大赛.webp';
import award5 from '../../assets/images/awards/联想AI比赛.webp';
import award7 from '../../assets/images/awards/MJ 官方优秀作品.webp';
import award8 from '../../assets/images/awards/无限剧场小赛.webp';
import award9 from '../../assets/images/awards/海纳星火计划-打工喵的一天.webp';
import douyinScreenshot from '../../assets/images/social-profiles/抖音主页.webp';
import xiaohongshuScreenshot from '../../assets/images/social-profiles/小红书主页.webp';
import kuaishouScreenshot from '../../assets/images/social-profiles/快手主页.webp';
import wechatChannelScreenshot from '../../assets/images/social-profiles/视频号主页.webp';
import wechatChannelQrCode from '../../assets/images/social-profiles/视频号二维码.webp';
import douyinQrCode from '../../assets/images/social-profiles/抖音二维码.webp';
import xiaohongshuQrCode from '../../assets/images/social-profiles/小红书二维码.webp';
import kuaishouQrCode from '../../assets/images/social-profiles/快手二维码.webp';

// Gallery order is editorial; keep each original image and its bilingual proof
// attached to the same award. Two separate Haina pieces occupy positions 6/7.
const awards = [
  { image: award7, title: { zh: 'MJ 官方优秀作品', en: 'Midjourney Official Featured' }, meta: { zh: 'Midjourney / 官方精选', en: 'Midjourney / Official Selection' } },
  { image: award4, title: { zh: '未来AI设计大赛', en: 'Future AI Design Contest' }, meta: { zh: '美图 / 年度入围', en: 'Meitu / Annual Finalist' } },
  { image: award5, title: { zh: '联想AI比赛', en: 'Lenovo AI Competition' }, meta: { zh: '创作先锋奖 / 官号精选', en: 'Creative Pioneer / Official Selection' } },
  { image: award1, title: { zh: '海螺AI动物跳水', en: 'Hailuo AI Animal Diving' }, meta: { zh: '登陆LED大屏', en: 'Displayed on LED Screen' } },
  { image: award8, title: { zh: '无限剧场小赛', en: 'Infinite Theater Contest' }, meta: { zh: '可灵AI / 超棒奖', en: 'Kling AI / Awesome Award' } },
  { image: award3, title: { zh: '海纳星火计划', en: 'Spark of Haina Program' }, meta: { zh: '中国联通 / 三等奖', en: 'China Unicom / 3rd Prize' } },
  { image: award9, title: { zh: '海纳星火计划', en: 'Spark of Haina Program' }, meta: { zh: '中国联通 / 三等奖', en: 'China Unicom / 3rd Prize' } },
  { image: award2, title: { zh: '影视级特效小赛', en: 'Cinematic Effects Contest' }, meta: { zh: 'Pollo.ai / 优秀奖', en: 'Pollo.ai / Excellence Award' } },
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
    platform: { zh: '抖音', en: 'Douyin' },
    screenshot: douyinScreenshot,
    primary: { zh: { value: '144.6w', unit: '获赞' }, en: { value: '1.45M', unit: 'likes' } },
    secondary: { zh: '1.7w粉丝', en: '17K followers' },
    link: 'https://v.douyin.com/idVkRoxL/',
    qrNote: { zh: '使用 抖音 扫码访问 @Ai路人 主页', en: 'Scan with Douyin to visit @Ai路人 profile' },
    qrCode: douyinQrCode,
  },
  {
    id: 'xiaohongshu',
    platform: { zh: '小红书', en: 'REDnote' },
    screenshot: xiaohongshuScreenshot,
    primary: { zh: { value: '5.6w', unit: '获赞与收藏' }, en: { value: '56K', unit: 'likes & saves' } },
    secondary: { zh: '3494粉丝', en: '3.5K followers' },
    link: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470',
    qrNote: { zh: '使用 微信/小红书 扫码访问 @Ai路人 主页', en: 'Scan with WeChat or REDnote to visit @Ai路人 profile' },
    qrCode: xiaohongshuQrCode,
  },
  {
    id: 'kuaishou',
    platform: { zh: '快手', en: 'Kuaishou' },
    screenshot: kuaishouScreenshot,
    primary: { zh: { value: '9938', unit: '获赞' }, en: { value: '9.9K', unit: 'likes' } },
    secondary: { zh: '4475粉丝', en: '4.5K followers' },
    link: 'https://v.kuaishou.com/K75e2i3A',
    qrNote: { zh: '使用 微信/快手 扫码访问 @Ai路人 主页', en: 'Scan with WeChat or Kuaishou to visit @Ai路人 profile' },
    qrCode: kuaishouQrCode,
  },
  {
    id: 'wechat-channel',
    platform: { zh: '视频号', en: 'WeChat Channels' },
    screenshot: wechatChannelScreenshot,
    primary: { zh: { value: '9087', unit: '赞' }, en: { value: '9.1K', unit: 'likes' } },
    secondary: { zh: '4237喜爱', en: '4.2K favorites' },
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
      <h2 id={id} className="impact-title">{title}</h2>
    </div>
  );
}

function AwardGallery() {
  const lang = useLang();
  const [openIndex, setOpenIndex] = useState(-1);
  const [isClosing, setIsClosing] = useState(false);
  const [awardMotionVisible, setAwardMotionVisible] = useState(false);
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
  const viewerCloseRef = useRef(null);
  const viewerImageRef = useRef(null);
  const viewerFigureRef = useRef(null);
  const viewerCaptionRef = useRef(null);
  const [viewerSize, setViewerSize] = useState(null);
  const isOpen = openIndex >= 0;

  const open = useCallback((index, event) => {
    triggerRef.current = event.currentTarget;
    window.clearTimeout(closeTimerRef.current);
    closingRef.current = false;
    setIsClosing(false);
    setAwardMotionVisible(false);
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
    setAwardMotionVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setOpenIndex(-1);
      setIsClosing(false);
      closingRef.current = false;
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }, 220);
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
    const cards = [...rail.querySelectorAll(':scope > li')];
    if (!cards.length) return;

    const railStyle = window.getComputedStyle(rail);
    const clipInsets = railStyle.clipPath.match(/inset\(([^)]+)\)/)?.[1]
      .split(/\s+/)
      .map((value) => Number.parseFloat(value) || 0) ?? [0];
    const clipLeft = clipInsets.length === 4 ? clipInsets[3] : clipInsets.length === 2 ? clipInsets[1] : clipInsets[0];
    const clipRight = clipInsets.length >= 2 ? clipInsets[1] : clipInsets[0];
    const gap = Number.parseFloat(railStyle.columnGap || railStyle.gap) || 0;
    const cardWidth = cards[0].getBoundingClientRect().width;
    const visibleWidth = rail.clientWidth - clipLeft - clipRight;
    const pageSize = Math.max(1, Math.floor((visibleWidth + gap + 1) / (cardWidth + gap)));
    const visibleStart = rail.scrollLeft + clipLeft;
    const visibleEnd = rail.scrollLeft + rail.clientWidth - clipRight;
    const currentStart = cards.findIndex((card) => {
      const left = card.offsetLeft;
      return left >= visibleStart - 1 && left + cardWidth <= visibleEnd + 1;
    });
    const startIndex = currentStart >= 0 ? currentStart : cards.findIndex((card) => card.offsetLeft + cardWidth > visibleStart);
    const lastStart = Math.max(0, cards.length - pageSize);
    const previousAlignedStart = Math.floor(lastStart / pageSize) * pageSize;
    const targetIndex = direction > 0
      ? Math.min(lastStart, Math.max(0, startIndex) + pageSize)
      : (startIndex === lastStart && lastStart % pageSize !== 0
        ? previousAlignedStart
        : Math.max(0, startIndex - pageSize));
    const target = cards[targetIndex];
    const current = cards[Math.max(0, startIndex)];
    if (!target || !current) return;

    rail.scrollTo({
      left: rail.scrollLeft + target.offsetLeft - current.offsetLeft,
      behavior: 'smooth',
    });
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

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!closingRef.current) setAwardMotionVisible(true);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    const scroll = [window.scrollX, window.scrollY];
    const background = [...document.body.children].filter(node => node !== dialog && !node.contains(dialog));
    const inert = background.map(node => node.inert);
    background.forEach(node => {node.inert = true;});
    document.body.style.overflow = 'hidden';
    document.body.classList.add('award-viewer-open');
    viewerCloseRef.current?.focus({preventScroll:true});
    const onKeyDown = event => {
      if (event.key === 'Escape') {event.preventDefault();close();}
      if (event.key === 'ArrowRight') {event.preventDefault();step(1);}
      if (event.key === 'ArrowLeft') {event.preventDefault();step(-1);}
      if (event.key === 'Tab') {
        const controls = [...dialog.querySelectorAll('a[href],button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {event.preventDefault();last?.focus();}
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {event.preventDefault();first?.focus();}
      }
    };
    const onFocus = event => {if (!dialog.contains(event.target)) viewerCloseRef.current?.focus({preventScroll:true});};
    document.addEventListener('keydown',onKeyDown);
    document.addEventListener('focusin',onFocus);
    window.addEventListener('popstate',close);
    return () => {
      document.removeEventListener('keydown',onKeyDown);
      document.removeEventListener('focusin',onFocus);
      window.removeEventListener('popstate',close);
      background.forEach((node,index) => {node.inert = inert[index];});
      document.body.classList.remove('award-viewer-open');
      document.body.style.overflow = overflow;
      window.scrollTo(...scroll);
      triggerRef.current?.focus({preventScroll:true});
    };
  }, [isOpen, close, step]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const image = viewerImageRef.current;
    const figure = viewerFigureRef.current;
    const caption = viewerCaptionRef.current;
    const fit = () => {
      if (!image.complete || !image.naturalWidth || !image.naturalHeight) return;
      const viewport = window.visualViewport;
      const width = Math.min(viewport?.width || innerWidth, document.documentElement.clientWidth);
      const height = Math.min(viewport?.height || innerHeight, innerHeight);
      const mobile = width <= 760;
      const style = getComputedStyle(dialogRef.current);
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const ratio = image.naturalWidth / image.naturalHeight;
      const arrowSpace = mobile ? 0 : 136; // 48px controls + 20px gaps
      const maxWidth = Math.min(960, width - horizontalPadding - arrowSpace);
      let mediaWidth = maxWidth;
      for (let pass = 0; pass < 4; pass++) {
        figure.style.width = `${mediaWidth + arrowSpace}px`;
        const informationHeight = caption.getBoundingClientRect().height + 14 + (mobile ? 62 : 0);
        const availableHeight = height - verticalPadding - informationHeight;
        let nextWidth = Math.min(maxWidth, Math.max(160, availableHeight) * ratio);
        // Long images and short viewports remain readable in this one scroller.
        if (ratio < 1) nextWidth = Math.max(nextWidth, Math.min(220, maxWidth));
        if (Math.abs(nextWidth - mediaWidth) < .1) break;
        mediaWidth = nextWidth;
      }
      figure.style.width = `${mediaWidth + arrowSpace}px`;
      setViewerSize(previous => previous && Math.abs(previous.width - mediaWidth) < .1 && Math.abs(previous.height - mediaWidth / ratio) < .1 && previous.mobile === mobile
        ? previous : {width: mediaWidth, height: mediaWidth / ratio, figureWidth: mediaWidth + arrowSpace, mobile});
    };
    fit();
    image.addEventListener('load', fit);
    const observer = new ResizeObserver(fit);
    observer.observe(caption);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      image.removeEventListener('load', fit);
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, [isOpen, openIndex, lang]);

  const active = isOpen ? awards[openIndex] : null;
  const galleryHint = lang === 'en'
    ? (isMobile ? 'SWIPE TO VIEW' : 'BROWSE WITH ARROWS · CLICK TO VIEW')
    : (isMobile ? '滑动浏览' : '左右浏览 · 点击查看');

  return (
    <div className="impact-glass impact-award-shell" onTouchStart={handleRailTouchStart} onTouchMove={handleRailTouchMove} onTouchEnd={handleRailTouchEnd} onTouchCancel={handleRailTouchCancel}>
      <div id="impact-award-gallery-note" className="impact-evidence-note"><span>{lang === 'en' ? 'AWARDS & SHOWCASES' : '荣誉与展映'}</span><span>{galleryHint}</span></div>
      <p className="impact-award-description">{lang === 'en' ? 'AI contest awards, selections and public showcases.' : 'AI 创作赛事获奖、入围及展映记录。'}</p>
      <button
        type="button"
        className="impact-award-rail-nav impact-award-rail-nav--prev"
        aria-label={lang === 'en' ? 'Scroll awards left' : '向左浏览获奖荣誉'}
        aria-controls="impact-award-rail"
        disabled={!railState.canScrollLeft}
        onClick={() => scrollRail(-1)}
      >
        <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 5-7 7 7 7" /></svg>
      </button>
      <button
        type="button"
        className="impact-award-rail-nav impact-award-rail-nav--next"
        aria-label={lang === 'en' ? 'Scroll awards right' : '向右浏览获奖荣誉'}
        aria-controls="impact-award-rail"
        disabled={!railState.canScrollRight}
        onClick={() => scrollRail(1)}
      >
        <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8.5 5 7 7-7 7" /></svg>
      </button>
      <ul id="impact-award-rail" ref={railRef} className="impact-award-rail" aria-label={lang === 'en' ? 'Awards and recognition images' : '获奖荣誉图片'} aria-describedby="impact-award-gallery-note" aria-live={isMobile ? 'polite' : 'off'} tabIndex={0}>
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
              <span className="impact-award-card-content">
                <img src={award.image} alt={award.title[lang]} width="1124" height="2000" loading={index < 4 ? 'eager' : 'lazy'} decoding="async" onLoad={syncRail} />
                <span className="impact-award-card-caption" aria-hidden="true">
                  <strong>{award.title[lang]}</strong>
                  <small>{award.meta[lang]}</small>
                </span>
              </span>
            </button>
          </li>
          );
        })}
      </ul>
      <div className="impact-award-pagination" role="tablist" aria-label={lang === 'en' ? 'Select an award or recognition' : '选择获奖荣誉'}>
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
          className={`impact-award-lightbox${awardMotionVisible && !isClosing ? ' is-motion-visible' : ''}${isClosing ? ' is-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="impact-award-lightbox-title"
          aria-describedby="impact-award-lightbox-meta"
          tabIndex={-1}
        >
          <CinemaNavigation lang={lang} closeRef={viewerCloseRef} onClose={close} />
          <figure ref={viewerFigureRef} style={viewerSize ? {width:viewerSize.figureWidth} : undefined} onClick={(event) => event.stopPropagation()}>
            <img ref={viewerImageRef} src={active.image} alt={active.title[lang]} className={active.image === award1 ? 'impact-award-image--trim-right' : undefined} style={viewerSize ? {width:viewerSize.width,height:viewerSize.height} : undefined} />
            <figcaption ref={viewerCaptionRef} aria-live="polite">
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
  const t = useT();
  const [activeProfile, setActiveProfile] = useState(null);
  const [profileImageFailed, setProfileImageFailed] = useState({ screenshot: false, qr: false });
  const [isProfileClosing, setIsProfileClosing] = useState(false);
  const [profileMotionVisible, setProfileMotionVisible] = useState(false);
  const profileDialogRef = useRef(null);
  const profileViewerRef = useRef(null);
  const profileCloseRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const profileFocusIdRef = useRef(null);
  const profileCloseTimerRef = useRef(null);
  const profileClosingRef = useRef(false);

  const openProfile = (card, event) => {
    profileTriggerRef.current = event.currentTarget;
    window.clearTimeout(profileCloseTimerRef.current);
    profileClosingRef.current = false;
    setProfileImageFailed({ screenshot: false, qr: false });
    setIsProfileClosing(false);
    setProfileMotionVisible(false);
    setActiveProfile(card);
  };

  const closeProfile = useCallback(() => {
    if (!activeProfile || profileClosingRef.current) return;
    profileClosingRef.current = true;
    const finish = () => {
      profileFocusIdRef.current = activeProfile.id;
      setActiveProfile(null);
      setIsProfileClosing(false);
      profileClosingRef.current = false;
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    setIsProfileClosing(true);
    setProfileMotionVisible(false);
    profileCloseTimerRef.current = window.setTimeout(finish, 220);
  }, [activeProfile]);

  useEffect(() => () => window.clearTimeout(profileCloseTimerRef.current), []);
  useLayoutEffect(() => {
    if (!activeProfile) return undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!profileClosingRef.current) setProfileMotionVisible(true);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [Boolean(activeProfile)]);

  // Restore keyboard focus only after modal unmount restores the page's inert state.
  useLayoutEffect(() => {
    if (activeProfile || !profileFocusIdRef.current) return;
    const focusId = profileFocusIdRef.current;
    const trigger = document.querySelector('[data-social-profile-trigger="' + focusId + '"]');
    (trigger || profileTriggerRef.current)?.focus({ preventScroll: true });
    profileFocusIdRef.current = null;
  }, [activeProfile]);

  // Viewer navigation is shared with award and work detail viewers.
  // Keep exactly one modal capsule; the source page remains inert.
  useLayoutEffect(() => {
    if (!activeProfile) return undefined;
    const viewer = profileViewerRef.current;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const background = [...body.children].filter(node => node !== viewer && !node.contains(viewer));
    const previousInert = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    body.style.overflow = 'hidden';
    body.classList.add('profile-viewer-open');
    profileCloseRef.current?.focus({ preventScroll: true });

    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeProfile(); }
      if (event.key !== 'Tab') return;
      const controls = [...viewer.querySelectorAll('a[href],button:not(:disabled)')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); profileCloseRef.current?.focus({ preventScroll: true }); }
      else if (event.shiftKey && (document.activeElement === first || !viewer.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !viewer.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = event => {
      if (!viewer.contains(event.target)) profileCloseRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocus);
      background.forEach((node, index) => { node.inert = previousInert[index]; });
      body.style.overflow = previousOverflow;
      body.classList.remove('profile-viewer-open');
    };
  }, [activeProfile, closeProfile]);

  const formatMetric = (value) => (lang === 'zh' ? value.replace(/w$/i, '万') : value);
  const featureCard = reachCards[0];
  const profileRecords = reachCards.slice(1);

  return (
    <div className="impact-glass impact-reach-dossier">
      <div className="impact-reach-dossier-head">
        <span>{t('多平台账号', 'SOCIAL CHANNELS')}</span>
      </div>
      <div className="impact-reach-layout">
        <article className="impact-reach-feature">
          <div className="impact-reach-feature-main">
            <h3 className="impact-reach-account-name">{featureCard.platform[lang]}</h3>
            <div className="impact-reach-feature-metrics">
              <strong className="impact-reach-feature-primary">
                <span>{formatMetric(featureCard.primary[lang].value)}</span>
                <small>{featureCard.primary[lang].unit}</small>
              </strong>
              <span className="impact-reach-feature-secondary">{formatMetric(featureCard.secondary[lang])}</span>
            </div>
          </div>
          <div className="impact-reach-feature-actions">
            <button className="impact-reach-action" type="button" data-social-profile-trigger={featureCard.id} aria-haspopup="dialog" aria-label={featureCard.platform[lang] + ' · ' + t('查看账号资料', 'View account details')} onClick={(event) => openProfile(featureCard, event)}>
              {t('查看账号资料', 'View account details')}
            </button>
            <a className="impact-reach-action" href={featureCard.link} target="_blank" rel="noopener noreferrer">
              {t('访问主页', 'Visit homepage')} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>

        <div className="impact-reach-account-list">
          {profileRecords.map((card) => (
            <article className="impact-reach-account-record" key={card.id}>
              <div className="impact-reach-record-main">
                <h3 className="impact-reach-account-name">{card.platform[lang]}</h3>
                <div className="impact-reach-record-metrics">
                  <strong>{formatMetric(card.primary[lang].value)} <small>{card.primary[lang].unit}</small></strong>
                  <span>{formatMetric(card.secondary[lang])}</span>
                </div>
              </div>
              <div className="impact-reach-record-actions">
                <button className="impact-reach-action" type="button" data-social-profile-trigger={card.id} aria-haspopup="dialog" aria-label={card.platform[lang] + ' · ' + t('查看账号资料', 'View account details')} onClick={(event) => openProfile(card, event)}>
                  {t('查看账号资料', 'View account details')}
                </button>
                {card.link && (
                  <a className="impact-reach-action" href={card.link} target="_blank" rel="noopener noreferrer">
                    {t('访问主页', 'Visit homepage')} <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      {activeProfile && createPortal(
        <div
          ref={profileViewerRef}
          className={`impact-profile-lightbox${profileMotionVisible && !isProfileClosing ? ' is-motion-visible' : ''}${isProfileClosing ? ' is-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="impact-profile-dialog-title"
          tabIndex={-1}
          onClick={event => { if (event.target === event.currentTarget) closeProfile(); }}
        >
          <CinemaNavigation lang={lang} closeRef={profileCloseRef} onClose={closeProfile} />
          <div
            ref={profileDialogRef}
            className="impact-profile-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="impact-profile-dialog-title">{activeProfile.platform[lang]}</h2>
            <div className="impact-profile-dialog-content">
              <figure className="impact-profile-proof">
                <figcaption>{t('账号主页', 'Account profile')}</figcaption>
                {profileImageFailed.screenshot ? (
                  <p className="impact-profile-dialog-error" role="status">
                    {t('账号截图暂时无法加载。', 'Account screenshot is unavailable.')}
                  </p>
                ) : (
                  <img
                    className="impact-profile-dialog-image"
                    src={activeProfile.screenshot}
                    alt={lang === 'en' ? `${activeProfile.platform.en} account screenshot` : `${activeProfile.platform.zh}账号主页截图`}
                    decoding="async"
                    onError={() => setProfileImageFailed(previous => ({ ...previous, screenshot: true }))}
                  />
                )}
              </figure>
              <aside className="impact-profile-qr-panel">
                <div className="impact-profile-qr-heading">{t('扫码访问', 'Scan to visit')}</div>
                {profileImageFailed.qr ? (
                  <p className="impact-profile-dialog-error" role="status">
                    {t('二维码暂时无法加载。', 'QR code is unavailable.')}
                  </p>
                ) : (
                  <img
                    className="impact-profile-dialog-image is-qr"
                    src={activeProfile.qrCode}
                    alt={lang === 'en' ? `${activeProfile.platform.en} QR code` : `${activeProfile.platform.zh}二维码`}
                    decoding="async"
                    onError={() => setProfileImageFailed(previous => ({ ...previous, qr: true }))}
                  />
                )}
                <p className="impact-profile-dialog-qr-note">{activeProfile.qrNote[lang]}</p>
                {!profileImageFailed.qr && (
                  <a className="impact-profile-dialog-action" href={activeProfile.qrCode} download={activeProfile.id + '-qr-code.webp'}>
                    {t('保存二维码', 'Save QR code')}
                  </a>
                )}
              </aside>
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
        <ImpactLabel id="impact-awards-heading" index="01 / AI AWARDS & RECOGNITION" title={lang === 'en' ? 'AI Awards & Recognition' : 'AI 获奖荣誉'} />
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
