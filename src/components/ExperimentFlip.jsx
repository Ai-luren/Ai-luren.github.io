import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n/index.js';
import CinemaNavigation from './CinemaNavigation.jsx';
import ExternalLinkSheet, { useTouchExternalLink } from './ExternalLinkSheet.jsx';
import newsJiuya from '../../assets/images/lab/news/juya-card.webp';
import newsAiHot from '../../assets/images/lab/news/aihot-card.webp';
import newsBuilders from '../../assets/images/lab/news/builders-card.webp';
import illustrationA from '../../assets/images/lab/illustrations/01-two-breakpoints.webp';
import illustrationB from '../../assets/images/lab/illustrations/02-sort-by-purpose.webp';
import illustrationC from '../../assets/images/lab/illustrations/05-information-well.webp';
import illustrationD from '../../assets/images/lab/illustrations/08-trust-bridge.webp';
import comparisonShowcase from '../../assets/images/lab/comparison/live-showcase.png';
import './ExperimentFlip.css';

// Descriptions are based on each project's existing published capability notes.
// No unrelated image or fake live demonstration is presented as project proof.
const experiments = [
  {
    id: 'news', index: '01',
    title: { zh: 'AI 新闻追踪', en: 'AI News Tracker' },
    description: { zh: '聚合多源 AI 资讯，飞书卡片定时推送并去重', en: 'Aggregates AI news from multiple sources into deduped, scheduled Lark card updates' },
    facts: [{ zh: 'RSS 聚合', en: 'RSS aggregation' }, { zh: '飞书卡片', en: 'Lark cards' }, { zh: '定时推送', en: 'Scheduled delivery' }],
    detail: { zh: '面向日常 AI 资讯追踪，将多来源内容聚合、整理后，通过飞书卡片进行定时更新，减少手动收集与重复阅读。', en: 'An AI news tracking workflow that brings multiple sources together, organizes updates, and delivers scheduled Lark cards to reduce manual collection and duplicates.' },
    steps: [
      { zh: '采集多源 RSS 资讯', en: 'Collect updates from RSS sources' },
      { zh: '合并内容并去除重复', en: 'Aggregate and deduplicate' },
      { zh: '生成飞书卡片并定时推送', en: 'Create and schedule Lark card updates' }
    ],
    gallery: [
      { src: newsJiuya, title: { zh: '橘鸦 AI 早报', en: 'Juya AI briefing' } },
      { src: newsAiHot, title: { zh: 'AI HOT 日报', en: 'AI HOT digest' } },
      { src: newsBuilders, title: { zh: 'AI 创作者动态', en: 'AI builders updates' } }
    ],
    href: 'https://github.com/Ai-luren/Ainews-to-Feishu'
  },
  {
    id: 'illustration', index: '02',
    title: { zh: 'AI 文章配图', en: 'AI Editorial Illustration' },
    description: { zh: '提取认知锚点，生成白底手绘风格正文配图', en: 'Identifies key ideas and creates clean, hand-drawn illustrations for articles' },
    facts: ['Codex Skill', { zh: '16:9 配图', en: '16:9 visuals' }, 'Shot list'],
    detail: { zh: '围绕文章中的核心信息提取认知锚点，再将视觉主题转为适合正文阅读的 16:9 白底手绘风格配图方案。', en: 'A workflow for extracting key ideas from written content and translating them into readable, 16:9 hand-drawn editorial illustration concepts.' },
    steps: [
      { zh: '理解文章与提取认知锚点', en: 'Read the article and identify key ideas' },
      { zh: '整理画面主题与镜头清单', en: 'Plan visual concepts and shot lists' },
      { zh: '生成适合正文的配图', en: 'Produce editorial-friendly illustrations' }
    ],
    gallery: [
      { src: illustrationA, title: { zh: '两个断点', en: 'Two breakpoints' } },
      { src: illustrationB, title: { zh: '按目的分拣', en: 'Sort by purpose' } },
      { src: illustrationC, title: { zh: '信息井', en: 'Information well' } },
      { src: illustrationD, title: { zh: '信任桥', en: 'Bridge of trust' } }
    ],
    href: 'https://github.com/Ai-luren/Ailuren-illustrations'
  },
  {
    id: 'compare', index: '03',
    title: { zh: '图片对比工具', en: 'Image Comparison Tool' },
    description: { zh: '把两张图放进同一画布，检查 AI 修图前后细节', en: 'Compares before/after AI edits on one shared canvas, with synced zoom for detail review' },
    facts: [{ zh: '纯前端', en: 'Pure front-end' }, 'Before / After', { zh: '同步缩放', en: 'Sync zoom' }],
    detail: { zh: '为 AI 修图效果核对提供前后对照视图，将两张图片置于同一工作画布，以同步缩放辅助观察画面细节差异。', en: 'A front-end comparison workflow for checking AI retouching changes using before/after imagery on one canvas with synchronized zoom.' },
    steps: [
      { zh: '导入修图前后的两张图片', en: 'Load before and after images' },
      { zh: '在同一画布中对照画面', en: 'Compare images on one canvas' },
      { zh: '同步缩放检查局部细节', en: 'Use synchronized zoom to inspect details' }
    ],
    gallery: [{ src: comparisonShowcase, title: { zh: '真实界面组合预览 · 示例输入', en: 'Real UI composite · sample images' } }],
    liveUrl: 'https://ai-luren.github.io/Image-comparison/',
    href: 'https://github.com/Ai-luren/Image-comparison'
  }
];

const pick = (value, lang) => (typeof value === 'string' ? value : value[lang]);

// Decode the lead image before opening or switching projects so visitors never
// encounter an empty showcase panel while browsing the in-site portfolio.
const readyImage = async src => {
  const image = new Image();
  image.src = src;
  try {
    if (image.decode) await image.decode();
    else await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
  } catch { /* Broken images still render their browser fallback/alt text. */ }
};


const IconArrow = ({ direction = 'right' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {direction === 'left' ? <path d="m14.5 5-7 7 7 7" /> : <path d="m9.5 5 7 7-7 7" />}
  </svg>
);

// One focused screenshot and compact selectors per project. README content
// remains in GitHub; the viewer is a one-screen proof, not a documentation page.
function ProjectShowcase({ active, lang, selectedIndex, onSelect, imagePending }) {
  const image = active.gallery[selectedIndex] ?? active.gallery[0];
  return <section className={`lab-project-showcase lab-project-showcase--${active.id}`}
    aria-label={lang === 'zh' ? '项目实际展示' : 'Project visuals'}>
    <figure className="lab-project-image-frame">
      <div className="lab-project-image-canvas" style={{ '--lab-image-ambient': `url("${image.src}")` }}>
        <img src={image.src} alt={pick(image.title, lang)} loading="eager" decoding="sync" />
      </div>
      <figcaption>
        <span>{pick(image.title, lang)}</span>
        {active.gallery.length > 1 && <span className="lab-project-showcase-count">{selectedIndex + 1} / {active.gallery.length}</span>}
      </figcaption>
    </figure>
    {active.gallery.length > 1 && <div className="lab-project-image-tabs" role="group" aria-label={lang === 'zh' ? '选择项目展示图片' : 'Select project visual'}>
      {active.gallery.map((frame, i) => <button key={frame.src} type="button"
            className={i === selectedIndex ? 'is-active' : ''} aria-pressed={i === selectedIndex}
            aria-label={pick(frame.title, lang)} aria-busy={imagePending === i}
            title={pick(frame.title, lang)} onClick={() => onSelect(i)}>
            <img src={frame.src} alt="" loading="eager" decoding="async" />
          </button>)}
    </div>}
  </section>;
}

export default function ExperimentFlip() {
  const lang = useLang();
  const [activeIndex, setActiveIndex] = useState(null);
  const [visualIndex, setVisualIndex] = useState(0);
  const [pendingProject, setPendingProject] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const imageRequestRef = useRef(0);
  const activeIndexRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const viewerRef = useRef(null);
  const { pendingLink: touchLink, closeLink, intercept } = useTouchExternalLink();
  const active = activeIndex === null ? null : experiments[activeIndex];
  activeIndexRef.current = activeIndex;
  const close = () => {
    ++imageRequestRef.current;
    setPendingProject(null);
    setPendingImage(null);
    setActiveIndex(null);
  };
  const openProject = async (index, trigger) => {
    triggerRef.current = trigger;
    const request = ++imageRequestRef.current;
    setPendingProject(index);
    await readyImage(experiments[index].gallery[0].src);
    if (request !== imageRequestRef.current) return;
    setVisualIndex(0);
    activeIndexRef.current = index;
    setActiveIndex(index);
    setPendingProject(null);
  };
  const changeProject = async next => {
    const index = next(activeIndexRef.current);
    const request = ++imageRequestRef.current;
    setPendingProject(index);
    await readyImage(experiments[index].gallery[0].src);
    if (request !== imageRequestRef.current || activeIndexRef.current === null) return;
    activeIndexRef.current = index;
    setVisualIndex(0);
    setActiveIndex(index);
    setPendingProject(null);
    viewerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };
  const changeImage = async index => {
    if (!active) return;
    const project = activeIndexRef.current;
    const request = ++imageRequestRef.current;
    setPendingImage(index);
    await readyImage(experiments[project].gallery[index].src);
    if (request !== imageRequestRef.current || activeIndexRef.current !== project) return;
    setVisualIndex(index);
    setPendingImage(null);
  };

  useEffect(() => {
    if (!active) return undefined;
    const viewer = viewerRef.current;
    const background = [...document.body.children].filter(node => node !== viewer && !node.contains(viewer));
    const previousInert = background.map(node => node.inert);
    const oldOverflow = document.body.style.overflow;
    background.forEach(node => { node.inert = true; });
    document.body.style.overflow = 'hidden';
    document.body.classList.add('lab-viewer-open');
    closeRef.current?.focus({ preventScroll: true });
    const onKey = event => {
      // A touch confirmation sheet can temporarily sit above the project viewer.
      // Its Escape/Tab keys belong to the sheet, not the underlying viewer.
      if (document.querySelector('.external-link-sheet')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); changeProject(i => (i + (event.key === 'ArrowRight' ? 1 : experiments.length - 1)) % experiments.length);
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = [...viewer.querySelectorAll('a[href],button:not(:disabled)')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && (document.activeElement === first || !viewer.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !viewer.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      background.forEach((node, i) => { node.inert = previousInert[i]; });
      document.body.style.overflow = oldOverflow;
      document.body.classList.remove('lab-viewer-open');
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [Boolean(active)]);

  const handleSource = (event, item) => intercept(event, {
    href: item.href, zh: item.title.zh + ' · GitHub 源码', en: item.title.en + ' · GitHub source'
  });
  // Only touch-initiated source links need confirmation. Desktop remains a
  // native external link with a visible hover/focus hint.
  return (
    <>
      <div className="flip-experiment flip-experiment--editorial" aria-label={lang === 'en' ? 'AI lab projects' : 'AI 实验项目'}>
        <div className="flip-experiment__header" aria-hidden="true">
          <span>{lang === 'en' ? 'No.' : '序号'}</span>
          <span>{lang === 'en' ? 'Project' : '项目名称'}</span>
          <span>{lang === 'en' ? 'Description / Highlights' : '描述 / 技术标签'}</span>
          <span>{lang === 'en' ? 'Explore' : '查看'}</span>
        </div>
        <div className="flip-experiment__list">
          {experiments.map((item, i) => (
            <article className="flip-experiment__row" key={item.id} data-experiment-id={item.id}>
              <span className="flip-experiment__index" aria-hidden="true">{item.index}</span>
              <div className="flip-experiment__row-title"><h3>{pick(item.title, lang)}</h3></div>
              <div className="flip-experiment__meta">
                <p className="flip-experiment__row-description">{pick(item.description, lang)}</p>
                <div className="flip-experiment__facts" aria-label={lang === 'en' ? 'Project capability tags' : '项目能力标签'}>
                  {item.facts.map(fact => <span key={pick(fact, lang)}>{pick(fact, lang)}</span>)}
                </div>
              </div>
              <div className="flip-experiment__actions">
                <button type="button" className="flip-experiment__detail" aria-haspopup="dialog"
                  aria-busy={pendingProject === i}
                  onClick={event => openProject(i, event.currentTarget)}>
                  {lang === 'en' ? 'View project' : '查看项目'}
                </button>
                <a className="flip-experiment__link" href={item.href} target="_blank" rel="noopener noreferrer"
                  aria-label={lang === 'en' ? item.title.en + ' GitHub source (new tab)' : item.title.zh + ' GitHub 源码（新标签页）'}
                  onClick={event => handleSource(event, item)}>
                  {lang === 'en' ? 'Source' : '源码'} <span aria-hidden="true">↗</span>
                  <span className="flip-experiment__tooltip" role="tooltip">{lang === 'en' ? 'Open GitHub in a new tab' : '在新标签页打开 GitHub'}</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
      {active && createPortal(
        <div className="lab-project-lightbox is-motion-visible" role="dialog" aria-modal="true"
          aria-labelledby="lab-project-title" ref={viewerRef} onClick={event => { if (event.target === event.currentTarget) close(); }}>
          <CinemaNavigation lang={lang} closeRef={closeRef} onClose={close} label={lang === 'en' ? 'Project details navigation' : '项目详情导航'} />
          <div className="lab-project-dialog" aria-busy={pendingProject !== null || pendingImage !== null}>
            <div className="lab-project-intro">
              <p className="lab-project-kicker">AI LAB / {active.index}</p>
              <h2 id="lab-project-title">{pick(active.title, lang)}</h2>
              <p className="lab-project-lead">{pick(active.description, lang)}</p>
              <div className="lab-project-facts" aria-label={lang === 'zh' ? '项目能力' : 'Key capabilities'}>
                {active.facts.slice(0, 3).map(fact => <span key={pick(fact, lang)}>{pick(fact, lang)}</span>)}
              </div>
            </div>
            <ProjectShowcase active={active} lang={lang} selectedIndex={visualIndex} onSelect={changeImage} imagePending={pendingImage} />
            <div className="lab-project-footer">
              <div className="lab-project-actions">
                {active.liveUrl && <a className="lab-project-source lab-project-source--primary" href={active.liveUrl} target="_blank" rel="noopener noreferrer" onClick={event => intercept(event, {
                  href: active.liveUrl, zh: '图片对比工具 · 在线体验', en: 'Image Comparison Tool · Live demo'
                })}>{lang === 'zh' ? '在线体验' : 'Try online'} <span aria-hidden="true">↗</span></a>}
                <a className="lab-project-source" href={active.href} target="_blank" rel="noopener noreferrer" onClick={event => handleSource(event, active)}>
                  {lang === 'en' ? 'GitHub source' : 'GitHub 源码'} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
            <div className="lab-project-pagination" role="group" aria-label={lang === 'en' ? 'Browse lab projects' : '切换实验项目'}>
              <button type="button" disabled={pendingProject !== null} aria-label={lang === 'en' ? 'Previous project' : '上一个项目'}
                onClick={() => changeProject(i => (i + experiments.length - 1) % experiments.length)}>
                <IconArrow direction="left" />
              </button>
              <span>{activeIndex + 1} / {experiments.length}</span>
              <button type="button" disabled={pendingProject !== null} aria-label={lang === 'en' ? 'Next project' : '下一个项目'}
                onClick={() => changeProject(i => (i + 1) % experiments.length)}>
                <IconArrow />
              </button>
            </div>
          </div>
        </div>, document.body
      )}
      <ExternalLinkSheet link={touchLink} onClose={closeLink} lang={lang} />
    </>
  );
}
