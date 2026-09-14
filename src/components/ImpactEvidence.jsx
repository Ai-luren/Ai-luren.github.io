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
  { src: klingLogo, width: 640, height: 640, alt: { zh: '可灵优创', en: 'Kling Creator' }, title: { zh: '可灵优创', en: 'Kling Creator' } },
  { src: jimengLogo, width: 640, height: 640, alt: { zh: '即梦', en: 'Jimeng' }, title: { zh: '即梦', en: 'Jimeng' } },
  { src: hailuoLogo, width: 640, height: 640, alt: { zh: '海螺 AI', en: 'Hailuo AI' }, title: { zh: '海螺 AI', en: 'Hailuo AI' } },
  { src: viduLogo, width: 640, height: 640, alt: 'Vidu', title: 'Vidu' },
  { src: pixverseLogo, width: 640, height: 640, alt: 'PixVerse', title: 'PixVerse' },
  { src: polloLogo, width: 446, height: 418, alt: 'Pollo AI', title: 'Pollo AI' },
  { src: midjourneyLogo, width: 640, height: 640, alt: 'Midjourney', title: 'Midjourney', className: 'logo-loop__image--light' },
  { src: qwenLogo, width: 640, height: 640, alt: { zh: '通义万相', en: 'Tongyi Wanxiang' }, title: { zh: '通义万相', en: 'Tongyi Wanxiang' } },
];

const reachCards = [
  {
    id: 'douyin',
    platform: { zh: '抖音', en: 'TikTok' },
    screenshot: douyinScreenshot,
    stats: { zh: '1.7w粉丝 144.6w赞', en: '17K followers · 1.45M likes' },
    link: 'https://v.douyin.com/idVkRoxL/',
    qrCode: douyinQrCode,
  },
  {
    id: 'xiaohongshu',
    platform: { zh: '小红书', en: 'Rednote' },
    screenshot: xiaohongshuScreenshot,
    stats: { zh: '3494粉丝 5.6w赞', en: '3.5K followers · 56K likes' },
    link: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470',
    qrCode: xiaohongshuQrCode,
  },
  {
    id: 'kuaishou',
    platform: { zh: '快手', en: 'Kuaishou' },
    screenshot: kuaishouScreenshot,
    stats: { zh: '4475粉丝 9938赞', en: '4.5K followers · 9.9K likes' },
    link: 'https://v.kuaishou.com/K75e2i3A',
    qrCode: kuaishouQrCode,
  },
  {
    id: 'wechat-channel',
    platform: { zh: '视频号', en: 'WeChat Channels' },
    screenshot: wechatChannelScreenshot,
    stats: { zh: '9087赞 4237喜爱', en: '9.1K likes · 4.2K favorites' },
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

function ImpactLabel({ index, title, description }) {
  return (
    <div className="impact-evidence-label">
      <span className="impact-eyebrow">{index.split(' / ')[0]}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function AwardGallery() {
  const lang = useLang();
  const [openIndex, setOpenIndex] = useState(-1);
  const [railState, setRailState] = useState({ canScrollLeft: false, canScrollRight: true });
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  ));
  const railRef = useRef(null);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const isOpen = openIndex >= 0;

  const open = useCallback((index, event) => {
    triggerRef.current = event.currentTarget;
    setOpenIndex(index);
  }, []);
  const close = useCallback(() => setOpenIndex(-1), []);
  const step = useCallback((delta) => {
    setOpenIndex((index) => (index < 0 ? index : (index + delta + awards.length) % awards.length));
  }, []);
  const syncRail = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setRailState({
      canScrollLeft: rail.scrollLeft > 2,
      canScrollRight: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
    });
  }, []);
  const scrollRail = useCallback((direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * .82, behavior: 'smooth' });
  }, []);

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
    <div className="impact-glass impact-award-shell">
      <div id="impact-award-gallery-note" className="impact-evidence-note"><span>{lang === 'en' ? 'AWARD CERTIFICATES' : 'AWARD CERTIFICATES / 获奖截图'}</span><span>{galleryHint}</span></div>
      <button
        type="button"
        className="impact-award-rail-nav impact-award-rail-nav--prev"
        aria-label={lang === 'en' ? 'Scroll awards left' : '向左浏览获奖作品'}
        aria-controls="impact-award-rail"
        disabled={!railState.canScrollLeft}
        onClick={() => scrollRail(-1)}
      >
        <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5-7 7 7 7" /></svg>
      </button>
      <button
        type="button"
        className="impact-award-rail-nav impact-award-rail-nav--next"
        aria-label={lang === 'en' ? 'Scroll awards right' : '向右浏览获奖作品'}
        aria-controls="impact-award-rail"
        disabled={!railState.canScrollRight}
        onClick={() => scrollRail(1)}
      >
        <svg className="impact-award-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m10 5 7 7-7 7" /></svg>
      </button>
      <ul id="impact-award-rail" ref={railRef} className="impact-award-rail" aria-label={lang === 'en' ? 'Award artwork' : '获奖作品图片'} aria-describedby="impact-award-gallery-note" tabIndex={0}>
        {awards.map((award, index) => (
          <li key={award.image}>
            <button
              type="button"
              className="impact-award-card"
              aria-label={lang === 'en' ? `Zoom in: ${award.title.en}` : `放大查看：${award.title.zh}`}
              aria-haspopup="dialog"
              aria-controls="impact-award-lightbox"
              onClick={(event) => open(index, event)}
            >
              <img src={award.image} alt={award.title[lang]} width="1124" height="2000" loading="lazy" decoding="async" onLoad={syncRail} />
              <span className="impact-award-card-zoom" aria-hidden="true">＋</span>
            </button>
          </li>
        ))}
      </ul>
      {/* 预览通过 Portal 独立于玻璃壳，避免 backdrop-filter 改变 fixed 定位；作为可退出的全屏模态层。 */}
      {active && createPortal(
        <div
          id="impact-award-lightbox"
          ref={dialogRef}
          className="impact-award-lightbox"
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
      <div className="impact-logo-head"><span>{lang === 'en' ? 'CREATOR PLATFORMS' : 'CREATOR PLATFORMS / 创作平台'}</span><span>{lang === 'en' ? 'SUPER CREATORS' : 'SUPER CREATORS / 超级创作者'}</span></div>
      {ready && <LogoLoop
        logos={logos}
        speed={0}
        logoHeight={40}
        gap={48}
        hoverSpeed={0}
        motionEnabled={false}
        ariaLabel={lang === 'en' ? 'Creator platform logos' : '创作者平台 Logo'}
      />}
    </div>
  );
}

function ReachDossier() {
  const lang = useLang();

  return (
    <div className="impact-glass impact-reach-dossier">
      <div className="impact-reach-dossier-head">
        <span>{lang === 'en' ? 'CONTENT REACH' : 'CONTENT REACH / 内容发布'}</span>
        <span>{lang === 'en' ? 'AI SOCIAL MEDIA' : 'AI SOCIAL MEDIA / AI 自媒体'}</span>
      </div>
      <div className="impact-reach-profile-grid">
        {reachCards.map((card) => {
          const hasLink = !!card.link;
          const hasQr = !!card.qrCode;
          const Tag = hasLink ? 'a' : 'div';
          const tagProps = hasLink
            ? { href: card.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': lang === 'en' ? `Visit ${card.platform.en} profile` : `访问${card.platform.zh}主页` }
            : {};
          const shotClass = `impact-reach-profile-shot${hasLink ? ' impact-reach-profile-shot--link' : ''}${hasQr ? ' impact-reach-profile-shot--qr' : ''}`;
          return (
            <article className="impact-reach-profile" key={card.id}>
              <Tag className={shotClass} {...tagProps}>
                <div className="impact-reach-profile-media">
                  <img src={card.screenshot} alt={lang === 'en' ? `${card.platform.en} profile screenshot` : `${card.platform.zh} 主页截图`} width="1179" height="938" loading="lazy" decoding="async" />
                </div>
                {hasQr && (
                  <div className="impact-reach-qr-popup">
                    <img src={card.qrCode} alt={lang === 'en' ? `${card.platform.en} QR code` : `${card.platform.zh}二维码`} width="630" height="632" loading="lazy" decoding="async" />
                    <span>{lang === 'en'
                      ? (card.id === 'douyin' ? `Scan with the TikTok app` : `Scan to visit ${card.platform.en}`)
                      : (card.id === 'douyin' ? `使用${card.platform.zh}扫码访问` : `扫码访问${card.platform.zh}`)}</span>
                  </div>
                )}
              </Tag>
              <div className="impact-reach-profile-caption"><strong>{card.platform[lang]}</strong><span>{card.stats[lang]}</span></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function ImpactEvidence() {
  const lang = useLang();
  return (
    <div className="impact-evidence">
      <section className="impact-evidence-row" aria-labelledby="impact-awards-title">
        <ImpactLabel index="01 / INDUSTRY AWARDS" title={lang === 'en' ? 'Awarded Works' : '获奖作品'} description={lang === 'en' ? 'AI creation contests with wins and finalists' : '参与 AI 创作赛事 含获奖和入围作品'} />
        <div><h3 id="impact-awards-title" className="sr-only">{lang === 'en' ? 'Industry Awards' : '行业奖项'}</h3><AwardGallery /></div>
      </section>
      <section className="impact-evidence-row" aria-labelledby="impact-programs-title">
        <ImpactLabel index="02 / CREATOR PROGRAMS" title={lang === 'en' ? 'Creator Platforms' : '创作平台'} description={lang === 'en' ? 'Super creator across multiple platforms' : '多个平台的超级创作者'} />
        <div><h3 id="impact-programs-title" className="sr-only">{lang === 'en' ? 'Creator Certifications' : '创作者认证'}</h3><LogoIndex /></div>
      </section>
      <section className="impact-evidence-row" aria-labelledby="impact-reach-title">
        <ImpactLabel index="03 / CONTENT REACH" title={lang === 'en' ? 'Content Publishing' : '内容发布'} description={lang === 'en' ? 'AI content shared on TikTok, Rednote, Kuaishou, and WeChat Channels' : '抖音、小红书、快手、视频号均有AI 内容分享'} />
        <div><h3 id="impact-reach-title" className="sr-only">{lang === 'en' ? 'Published Content' : '发过的内容'}</h3><ReachDossier /></div>
      </section>
    </div>
  );
}
