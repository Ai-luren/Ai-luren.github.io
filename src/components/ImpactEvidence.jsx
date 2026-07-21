import './ImpactEvidence.css';
import CircularGallery from './CircularGallery.jsx';
import LogoLoop from './LogoLoop.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';

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

const awards = [
  { image: award1, title: '无限剧场小赛', meta: '可灵 / 超棒奖' },
  { image: award2, title: '影视级特效小赛', meta: 'Pollo.ai / 优秀奖' },
  { image: award3, title: '中国联通 AI 创作赛', meta: '联通 / 三等奖' },
  { image: award4, title: '未来 AI 设计', meta: '美图 / 入围' },
  { image: award5, title: '平台官号转发', meta: '联想 / 官方认可' },
  { image: award7, title: 'MJ 官方优秀作品', meta: 'Midjourney / 官方精选' },
  { image: award8, title: '现实场景展示', meta: 'AI 视觉 / 入选' },
  { image: award9, title: '猫咪的一天', meta: '联通 / 三等奖' },
];

const creatorLogos = [
  { src: klingLogo, alt: '可灵优创', title: '可灵优创' },
  { src: jimengLogo, alt: '即梦', title: '即梦' },
  { src: hailuoLogo, alt: '海螺 AI', title: '海螺 AI' },
  { src: viduLogo, alt: 'Vidu', title: 'Vidu' },
  { src: pixverseLogo, alt: 'PixVerse', title: 'PixVerse' },
  { src: polloLogo, alt: 'Pollo AI', title: 'Pollo AI' },
  { src: midjourneyLogo, alt: 'Midjourney', title: 'Midjourney', className: 'logo-loop__image--light' },
  { src: qwenLogo, alt: '通义万相', title: '通义万相' },
];

const reachCards = [
  {
    id: 'douyin',
    platform: '抖音',
    screenshot: douyinScreenshot,
    stats: '1.7w粉丝 144.6w赞',
  },
  {
    id: 'xiaohongshu',
    platform: '小红书',
    screenshot: xiaohongshuScreenshot,
    stats: '3494粉丝 5.6w赞',
  },
  {
    id: 'kuaishou',
    platform: '快手',
    screenshot: kuaishouScreenshot,
    stats: '4475粉丝 9938赞',
  },
  {
    id: 'wechat-channel',
    platform: '视频号',
    screenshot: wechatChannelScreenshot,
    stats: '9087赞 4237喜爱',
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
  const galleryItems = useMemo(() => awards.map(({ image, title, meta }) => ({
    image,
    text: `${title} / ${meta}`
  })), []);

  return (
    <div className="impact-glass impact-award-shell">
      <div className="impact-evidence-note"><span>AWARD CERTIFICATES / 获奖截图</span><span>DRAG TO EXPLORE / 拖拽查看</span></div>
      <div ref={galleryRef} className="impact-circular-gallery">
        {loadedCount < awards.length && (
          <div className="impact-award-loader" role="status" aria-live="polite">
            <span>ARCHIVE LOADING</span>
            <strong>{ready ? `${loadedCount} / ${awards.length}` : '准备档案'}</strong>
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
            <div className="impact-award-mobile-grid" role="list" aria-label="获奖作品图片">
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
  return (
    <div ref={logoRef} className="impact-glass impact-logo-shell">
      <div className="impact-logo-head"><span>CREATOR PLATFORMS / 创作平台</span><span>SUPER CREATORS / 超级创作者</span></div>
      {ready && <LogoLoop
        logos={creatorLogos}
        speed={28}
        logoHeight={48}
        gap={48}
        hoverSpeed={0}
        ariaLabel="创作者平台 Logo"
      />}
    </div>
  );
}

function ReachDossier() {
  return (
    <div className="impact-glass impact-reach-dossier">
      <div className="impact-reach-dossier-head">
        <span>CONTENT REACH / 内容发布</span>
        <span>AI SOCIAL MEDIA / AI 自媒体</span>
      </div>
      <div className="impact-reach-profile-grid">
        {reachCards.map((card) => (
          <article className="impact-reach-profile" key={card.id}>
            <div className="impact-reach-profile-shot">
              <div className="impact-reach-profile-media">
                <img src={card.screenshot} alt={`${card.platform} 主页截图`} />
              </div>
            </div>
            <div className="impact-reach-profile-caption"><strong>{card.platform}</strong><span>{card.stats}</span></div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function ImpactEvidence() {
  return (
    <div className="impact-evidence">
      <section className="impact-evidence-row" aria-labelledby="impact-awards-title">
        <ImpactLabel index="01 / INDUSTRY AWARDS" title="获奖作品" description="参与 AI 创作赛事 含获奖和入围作品" />
        <div><h3 id="impact-awards-title" className="sr-only">行业奖项</h3><CircularAwardGallery /></div>
      </section>
      <section className="impact-evidence-row" aria-labelledby="impact-programs-title">
        <ImpactLabel index="02 / CREATOR PROGRAMS" title="创作平台" description="多个平台的超级创作者" />
        <div><h3 id="impact-programs-title" className="sr-only">创作者认证</h3><LogoIndex /></div>
      </section>
      <section className="impact-evidence-row" aria-labelledby="impact-reach-title">
        <ImpactLabel index="03 / CONTENT REACH" title="内容发布" description="抖音、小红书、快手、视频号均有AI 内容分享" />
        <div><h3 id="impact-reach-title" className="sr-only">发过的内容</h3><ReachDossier /></div>
      </section>
    </div>
  );
}
