import './ImpactEvidence.css';
import CircularGallery from './CircularGallery.jsx';
import LogoLoop from './LogoLoop.jsx';

import hailuoLogo from '../../创作者LOGO/hailuo-color.webp';
import jimengLogo from '../../创作者LOGO/jimeng-color.webp';
import klingLogo from '../../创作者LOGO/kling-color.webp';
import midjourneyLogo from '../../创作者LOGO/midjourney.webp';
import pixverseLogo from '../../创作者LOGO/pixverse-color.webp';
import polloLogo from '../../创作者LOGO/Pollo.webp';
import qwenLogo from '../../创作者LOGO/qwen-color.webp';
import viduLogo from '../../创作者LOGO/vidu-color.webp';

const awards = [
  { image: '获奖截图/画板 1.jpg', title: '无限剧场小赛', meta: '可灵 / 超棒奖' },
  { image: '获奖截图/画板 2.jpg', title: '影视级特效小赛', meta: 'Pollo.ai / 优秀奖' },
  { image: '获奖截图/画板 3.jpg', title: '中国联通 AI 创作赛', meta: '联通 / 三等奖' },
  { image: '获奖截图/画板 4.jpg', title: '未来 AI 设计', meta: '美图 / 入围' },
  { image: '获奖截图/画板 5.jpg', title: '平台官号转发', meta: '联想 / 官方认可' },
  { image: '获奖截图/画板 7.jpg', title: 'MJ 官方优秀作品', meta: 'Midjourney / 官方精选' },
  { image: '获奖截图/画板 8.jpg', title: '现实场景展示', meta: 'AI 视觉 / 入选' },
  { image: '获奖截图/画板 9.jpg', title: '猫咪的一天', meta: '联通 / 三等奖' },
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
    screenshot: '社交媒体主页/抖音主页.webp',
    stats: '1.7w粉丝 144.6w赞',
  },
  {
    id: 'xiaohongshu',
    platform: '小红书',
    screenshot: '社交媒体主页/小红书主页.webp',
    stats: '3494粉丝 5.6w赞',
  },
  {
    id: 'kuaishou',
    platform: '快手',
    screenshot: '社交媒体主页/快手主页.webp',
    stats: '4475粉丝 9938赞',
  },
  {
    id: 'wechat-channel',
    platform: '视频号',
    screenshot: '社交媒体主页/视频号主页.webp',
    stats: '9087赞 4237喜爱',
  },
];

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
  const galleryItems = awards.map(({ image, title, meta }) => ({
    image,
    text: `${title} / ${meta}`
  }));

  return (
    <div className="impact-glass impact-award-shell">
      <div className="impact-evidence-note"><span>AWARD CERTIFICATES / 获奖截图</span><span>DRAG TO EXPLORE / 拖拽查看</span></div>
      <div className="impact-circular-gallery">
        <CircularGallery
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
          verticalOffset={-0.25}
        />
      </div>
    </div>
  );
}

function LogoIndex() {
  return (
    <div className="impact-glass impact-logo-shell">
      <div className="impact-logo-head"><span>CREATOR PLATFORMS / 创作平台</span><span>SUPER CREATORS / 超级创作者</span></div>
      <LogoLoop
        logos={creatorLogos}
        speed={28}
        logoHeight={48}
        gap={48}
        hoverSpeed={0}
        ariaLabel="创作者平台 Logo"
      />
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
