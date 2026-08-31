import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Flip from 'gsap/Flip';
import GlareHover from './GlareHover.jsx';
import { getGsap } from '../gsap-runtime.js';
import { useLang } from '../i18n/index.js';
import './ExperimentFlip.css';

const experiments = [
  {
    id: 'news',
    index: '01',
    label: { zh: 'NEWS / AI 资讯', en: 'NEWS / AI FEED' },
    title: { zh: 'AI 新闻追踪', en: 'AI News Tracker' },
    description: { zh: '聚合多源 AI 资讯，飞书卡片定时推送并去重。', en: 'Aggregates AI news from multiple sources into deduped, scheduled Lark card updates.' },
    facts: [
      { zh: 'RSS 聚合', en: 'RSS aggregation' },
      { zh: '飞书卡片', en: 'Lark cards' },
      { zh: '定时推送', en: 'Scheduled delivery' },
    ],
    workflow: [
      ['RSS', { zh: '橘鸦 / AI HOT', en: 'Juyan / AI HOT' }],
      [{ zh: '抓取清洗', en: 'Fetch & Clean' }, { zh: '解析与去重', en: 'Parse and dedupe' }],
      [{ zh: '飞书卡片', en: 'Lark Cards' }, { zh: '结构化整理', en: 'Structured digest' }],
      [{ zh: '定时推送', en: 'Scheduled Push' }, { zh: '同步到群组', en: 'Sync to groups' }],
    ],
    href: 'https://github.com/Ai-luren/Ainews-to-Feishu',
    linkLabel: { zh: 'GitHub 开源项目', en: 'GitHub open-source project' },
  },
  {
    id: 'illustration',
    index: '02',
    label: { zh: 'IMAGE / 文章配图', en: 'IMAGE / ILLUSTRATION' },
    title: { zh: 'AI 文章配图', en: 'AI Article Illustration' },
    description: { zh: '提取认知锚点，生成白底手绘风格正文配图。', en: 'Extracts cognitive anchors and generates clean hand-drawn style article illustrations.' },
    facts: [
      'Codex Skill',
      { zh: '16:9 配图', en: '16:9 visuals' },
      'Shot list',
    ],
    workflow: [
      [{ zh: '文章输入', en: 'Article Input' }, { zh: '读取主题与上下文', en: 'Read theme and context' }],
      [{ zh: '认知锚点', en: 'Cognitive Anchor' }, { zh: '提炼一个核心判断', en: 'Distill one core insight' }],
      ['Shot list', { zh: '规划画面结构', en: 'Plan the composition' }],
      [{ zh: 'AI 配图', en: 'AI Visuals' }, { zh: '输出可复用 PNG', en: 'Reusable PNG output' }],
    ],
    href: 'https://github.com/Ai-luren/Ailuren-illustrations',
    linkLabel: { zh: 'GitHub 开源项目', en: 'GitHub open-source project' },
  },
  {
    id: 'compare',
    index: '03',
    label: { zh: 'TOOL / 图片对比', en: 'TOOL / IMAGE QA' },
    title: { zh: '图片对比工具', en: 'Image Comparison Tool' },
    description: { zh: '把两张图放进同一画布，检查 AI 修图前后细节。', en: 'Compares before/after AI edits on one shared canvas with synced zoom.' },
    facts: [
      { zh: '纯前端', en: 'Pure front-end' },
      'Before / After',
      { zh: '同步缩放', en: 'Sync zoom' },
    ],
    workflow: [
      ['Before / After', { zh: '拖入两张图片', en: 'Drop both images' }],
      [{ zh: '共同画布', en: 'Shared Canvas' }, { zh: '同一坐标对齐', en: 'Aligned coordinates' }],
      [{ zh: '同步缩放', en: 'Sync Zoom' }, { zh: '放大检查细节', en: 'Inspect details' }],
      [{ zh: '导出 PNG', en: 'Export PNG' }, { zh: '交付检查视图', en: 'Deliver review view' }],
    ],
    href: 'https://github.com/Ai-luren/Image-comparison',
    linkLabel: { zh: 'GitHub 开源项目', en: 'GitHub open-source project' },
  },
];

function ExperimentCard({ item, slot, onSelect, cardRef }) {
  const isFeature = slot === 'feature';
  const lang = useLang();
  const pick = (value) => (typeof value === 'string' ? value : value[lang]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(item.id);
    }
  };

  return (
    <GlareHover
      className={`flip-experiment__glare slot-${slot}${isFeature ? ' is-feature' : ''}`}
      width="100%"
      height="100%"
      background="rgba(5, 12, 20, .68)"
      borderRadius="18px"
      borderColor="rgba(224, 224, 224, .18)"
      glareColor="#ffffff"
      glareOpacity={0.25}
      glareAngle={-32}
      glareSize={220}
      transitionDuration={420}
    >
    <article
      ref={cardRef}
      className={`flip-experiment__card slot-${slot}${isFeature ? ' is-feature' : ''}`}
      data-slot={slot}
      data-experiment-id={item.id}
      tabIndex="0"
      role="button"
      aria-label={`${isFeature ? (lang === 'en' ? 'Current project' : '当前项目') : (lang === 'en' ? 'Switch to' : '切换到')}：${pick(item.title)}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="flip-experiment__meta">
        <span className="flip-experiment__number">{item.index}</span>
        <span className="flip-experiment__label">{pick(item.label)}</span>
      </div>
      <div className="flip-experiment__body">
        <div className="flip-experiment__copy">
          <h3>{pick(item.title)}</h3>
          <p>{pick(item.description)}</p>
          <div className="flip-experiment__facts" aria-label={lang === 'en' ? 'Project capability tags' : '项目能力标签'}>
            {item.facts.map((fact) => <span key={pick(fact)}>{pick(fact)}</span>)}
          </div>
          <a
            className="flip-experiment__link"
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {pick(item.linkLabel)} <span aria-hidden="true">↗</span>
          </a>
        </div>
        {isFeature && (
          <div className="flip-experiment__workflow" aria-label={`${pick(item.title)}${lang === 'en' ? ' workflow' : '工作流'}`}>
            <span className="flip-experiment__workflow-title">{lang === 'en' ? 'WORKFLOW' : 'WORKFLOW / 工作流'}</span>
            <ol>
              {item.workflow.map(([label, detail]) => (
                <li key={pick(label)}>
                  <span className="flip-experiment__workflow-node" aria-hidden="true" />
                  <span><strong>{pick(label)}</strong><small>{pick(detail)}</small></span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {!isFeature && <span className="flip-experiment__hint">{lang === 'en' ? 'Click to switch' : '点击切换'}</span>}
    </article>
    </GlareHover>
  );
}

export default function ExperimentFlip() {
  const rootRef = useRef(null);
  const cardRefs = useRef(new Map());
  const pendingFlipState = useRef(null);
  const [activeId, setActiveId] = useState(experiments[0].id);
  const lang = useLang();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const gsap = getGsap();
    if (!gsap) return undefined;
    gsap.registerPlugin(Flip);
    return () => {
      gsap.killTweensOf(root.querySelectorAll('.flip-experiment__card'));
    };
  }, []);

  useLayoutEffect(() => {
    const state = pendingFlipState.current;
    if (!state) return;
    const gsap = getGsap();
    if (!gsap) return;
    pendingFlipState.current = null;
    // 在 Flip 动画开始前，立即隐藏新 feature 卡的 workflow 子元素，
    // 避免它们先以可见态渲染再被 gsap.from 突然隐藏导致的闪烁。
    const featureCard = rootRef.current?.querySelector('.flip-experiment__card.is-feature');
    const workflowTitle = featureCard?.querySelector('.flip-experiment__workflow-title');
    const workflowOl = featureCard?.querySelector('.flip-experiment__workflow ol');
    const workflowItems = featureCard?.querySelectorAll('.flip-experiment__workflow li');
    if (workflowTitle) gsap.set(workflowTitle, { autoAlpha: 0 });
    if (workflowItems?.length) gsap.set(workflowItems, { autoAlpha: 0 });
    if (workflowOl) workflowOl.setAttribute('data-line', '0');
    Flip.from(state, {
      duration: 0.48,
      ease: 'power3.inOut',
      absolute: false,
      scale: false,
      nested: true,
      clearProps: 'transform',
      onComplete: () => {
        // 切换完成后：标题淡入 → 连线从左到右绘制 → 节点依次出现
        if (workflowTitle) {
          gsap.fromTo(workflowTitle,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.3, ease: 'power2.out' }
          );
        }
        if (workflowOl) {
          workflowOl.removeAttribute('data-line');
        }
        if (workflowItems?.length) {
          gsap.fromTo(workflowItems,
            { autoAlpha: 0, x: -8 },
            {
              autoAlpha: 1,
              x: 0,
              stagger: 0.1,
              duration: 0.28,
              ease: 'power2.out',
              delay: 0,
            }
          );
        }
      },
    });
  }, [activeId]);

  const selectExperiment = (id) => {
    if (id === activeId) return;
    const gsap = getGsap();
    if (!gsap) {
      setActiveId(id);
      return;
    }
    gsap.registerPlugin(Flip);
    const cards = Array.from(rootRef.current?.querySelectorAll('.flip-experiment__card') || []);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    // 移动端保持三张卡片静态展示，不因点击重排卡片或播放切换动画。
    if (isMobile) return;
    // 桌面端使用 Flip 保持卡片切换的空间连续性。
    const state = prefersReducedMotion || isMobile ? null : Flip.getState(cards, { props: 'borderRadius,boxShadow' });
    pendingFlipState.current = state;
    setActiveId(id);
  };

  const orderedIds = [activeId, ...experiments.map((item) => item.id).filter((id) => id !== activeId)];

  return (
    <div ref={rootRef} className="flip-experiment" aria-label={lang === 'en' ? 'AI experiments switchboard' : 'AI 实验项目切换台'}>
      <div className="flip-experiment__stage">
        {experiments.map((item) => {
          const slot = orderedIds.indexOf(item.id) === 0
            ? 'feature'
            : orderedIds.indexOf(item.id) === 1 ? 'secondary' : 'tertiary';
          return (
          <ExperimentCard
            key={item.id}
            item={item}
            slot={slot}
            onSelect={selectExperiment}
            cardRef={(node) => {
              if (node) cardRefs.current.set(item.id, node);
              else cardRefs.current.delete(item.id);
            }}
          />
          );
        })}
      </div>
      <div className="flip-experiment__status" aria-live="polite">
        <span className="flip-experiment__status-dot" aria-hidden="true" />
        {lang === 'en' ? 'Now viewing: ' : '当前查看：'}{experiments.find((item) => item.id === activeId)?.title[lang]}
      </div>
    </div>
  );
}
