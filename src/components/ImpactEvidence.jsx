import './ImpactEvidence.css';
import CircularGallery from './CircularGallery.jsx';
import LogoLoop from './LogoLoop.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  { image: award1, title: { zh: '无限剧场小赛', en: 'Infinite Theater Contest' }, meta: { zh: '可灵 / 超棒奖', en: 'Kling / Awesome Award' } },
  { image: award2, title: { zh: '影视级特效小赛', en: 'Cinematic Effects Contest' }, meta: { zh: 'Pollo.ai / 优秀奖', en: 'Pollo.ai / Excellence Award' } },
  { image: award3, title: { zh: '中国联通 AI 创作赛', en: 'China Unicom AI Contest' }, meta: { zh: '联通 / 三等奖', en: 'Unicom / 3rd Prize' } },
  { image: award4, title: { zh: '未来 AI 设计', en: 'Future AI Design' }, meta: { zh: '美图 / 入围', en: 'Meitu / Finalist' } },
  { image: award5, title: { zh: '平台官号转发', en: 'Official Repost' }, meta: { zh: '联想 / 官方认可', en: 'Lenovo / Official Recognition' } },
  { image: award7, title: { zh: 'MJ 官方优秀作品', en: 'Midjourney Official Featured' }, meta: { zh: 'Midjourney / 官方精选', en: 'Midjourney / Official Selection' } },
  { image: award8, title: { zh: '现实场景展示', en: 'Real-World Showcase' }, meta: { zh: 'AI 视觉 / 入选', en: 'AI Visual / Selected' } },
  { image: award9, title: { zh: '猫咪的一天', en: "A Cat's Day" }, meta: { zh: '联通 / 三等奖', en: 'Unicom / 3rd Prize' } },
];

const creatorLogos = [
  { src: klingLogo, alt: { zh: '可灵优创', en: 'Kling Creator' }, title: { zh: '可灵优创', en: 'Kling Creator' } },
  { src: jimengLogo, alt: { zh: '即梦', en: 'Jimeng' }, title: { zh: '即梦', en: 'Jimeng' } },
  { src: hailuoLogo, alt: { zh: '海螺 AI', en: 'Hailuo AI' }, title: { zh: '海螺 AI', en: 'Hailuo AI' } },
  { src: viduLogo, alt: 'Vidu', title: 'Vidu' },
  { src: pixverseLogo, alt: 'PixVerse', title: 'PixVerse' },
  { src: polloLogo, alt: 'Pollo AI', title: 'Pollo AI' },
  { src: midjourneyLogo, alt: 'Midjourney', title: 'Midjourney', className: 'logo-loop__image--light' },
  { src: qwenLogo, alt: { zh: '通义万相', en: 'Tongyi Wanxiang' }, title: { zh: '通义万相', en: 'Tongyi Wanxiang' } },
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
      <span className="impact-eyebrow">{index}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function CircularAwardGallery() {
  const [galleryRef, ready] = useNearViewport('700px');
  const [loadedCount, setLoadedCount] = useState(0);
  const lang = useLang();
  const galleryItems = useMemo(() => awards.map(({ image, title, meta }) => ({
    image,
    text: `${title[lang]} / ${meta[lang]}`
  })), [lang]);

  return (
    <div className="impact-glass impact-award-shell">
      <div className="impact-evidence-note"><span>{lang === 'en' ? 'AWARD CERTIFICATES' : 'AWARD CERTIFICATES / 获奖截图'}</span><span>{lang === 'en' ? 'DRAG TO EXPLORE' : 'DRAG TO EXPLORE / 拖拽查看'}</span></div>
      <div ref={galleryRef} className="impact-circular-gallery">
        {loadedCount < awards.length && (
          <div className="impact-award-loader" role="status" aria-live="polite">
            <span>ARCHIVE LOADING</span>
            <strong>{ready ? `${loadedCount} / ${awards.length}` : (lang === 'en' ? 'Preparing archive' : '准备档案')}</strong>
          </div>
        )}
        {ready && <CircularGallery
          items={galleryItems}
          bend={5}
          textColor="#d7e3eb"
          borderRadius={0.05}
          font="500 18px 'Noto Sans SC', sans-serif"
          scrollSpeed={2}
          scrollEase={0.05}
          showTitles={false}
          enableWheel={false}
          enableKeyboard={false}
          disableOnMobile
          verticalOffset={-0.25}
          onImageLoad={setLoadedCount}
          mobileFallback={(
            <div className="impact-award-mobile-grid" role="list" aria-label={lang === 'en' ? 'Award artwork' : '获奖作品图片'}>
              {galleryItems.map((item) => (
                <figure key={item.image} role="listitem">
                  <img src={item.image} alt={item.text} loading="lazy" decoding="async" onLoad={() => setLoadedCount((count) => Math.min(awards.length, count + 1))} />
                </figure>
              ))}
            </div>
          )}
        />}
      </div>
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
        speed={28}
        logoHeight={40}
        gap={48}
        hoverSpeed={0}
        ariaLabel={lang === 'en' ? 'Creator platform logos' : '创作者平台 Logo'}
      />}
    </div>
  );
}

function ReachDossier() {
  const lastTapRef = useRef({ time: 0, id: '' });
  const lang = useLang();

  const handleCardClick = (event, card) => {
    if (!card.link) return;
    // 移动端（触屏设备）需要双击才跳转，避免滑动时误触
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) {
      event.preventDefault();
      const now = Date.now();
      if (now - lastTapRef.current.time < 350 && lastTapRef.current.id === card.id) {
        lastTapRef.current.time = 0;
        window.open(card.link, '_blank', 'noopener,noreferrer');
      } else {
        lastTapRef.current = { time: now, id: card.id };
      }
      return;
    }
  };

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
            ? { href: card.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': lang === 'en' ? `Visit ${card.platform.en} profile` : `访问${card.platform.zh}主页`, onClick: (e) => handleCardClick(e, card) }
            : {};
          const shotClass = `impact-reach-profile-shot${hasLink ? ' impact-reach-profile-shot--link' : ''}${hasQr ? ' impact-reach-profile-shot--qr' : ''}`;
          return (
            <article className="impact-reach-profile" key={card.id}>
              <Tag className={shotClass} {...tagProps}>
                <div className="impact-reach-profile-media">
                  <img src={card.screenshot} alt={lang === 'en' ? `${card.platform.en} profile screenshot` : `${card.platform.zh} 主页截图`} />
                </div>
                {hasQr && (
                  <div className="impact-reach-qr-popup">
                    <img src={card.qrCode} alt={lang === 'en' ? `${card.platform.en} QR code` : `${card.platform.zh}二维码`} />
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
        <div><h3 id="impact-awards-title" className="sr-only">{lang === 'en' ? 'Industry Awards' : '行业奖项'}</h3><CircularAwardGallery /></div>
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
