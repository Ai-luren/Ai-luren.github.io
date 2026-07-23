import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Flip from 'gsap/Flip';
import GlareHover from './GlareHover.jsx';
import { getGsap } from '../gsap-runtime.js';
import './ExperimentFlip.css';

const experiments = [
  {
    id: 'news',
    index: '01',
    label: 'NEWS / AI 资讯',
    title: 'AI 新闻追踪',
    description: '聚合多源 AI 资讯，飞书卡片定时推送并去重。',
    facts: ['RSS 聚合', '飞书卡片', '定时推送'],
    workflow: [
      ['RSS', '橘鸦 / AI HOT'],
      ['抓取清洗', '解析与去重'],
      ['飞书卡片', '结构化整理'],
      ['定时推送', '同步到群组'],
    ],
    href: 'https://github.com/Ai-luren/Ainews-to-Feishu',
    linkLabel: 'GitHub 开源项目',
  },
  {
    id: 'illustration',
    index: '02',
    label: 'IMAGE / 文章配图',
    title: 'AI 文章配图',
    description: '提取认知锚点，生成白底手绘风格正文配图。',
    facts: ['Codex Skill', '16:9 配图', 'Shot list'],
    workflow: [
      ['文章输入', '读取主题与上下文'],
      ['认知锚点', '提炼一个核心判断'],
      ['Shot list', '规划画面结构'],
      ['AI 配图', '输出可复用 PNG'],
    ],
    href: 'https://github.com/Ai-luren/Ailuren-illustrations',
    linkLabel: 'GitHub 开源项目',
  },
  {
    id: 'portfolio',
    index: '03',
    label: 'SITE / AI 网页',
    title: 'AI 网页作品集',
    description: '用 Codex 和 Skill 做出滚动叙事作品集。',
    facts: ['Vite', 'React', 'GSAP'],
    workflow: [
      ['想法', '确定内容与叙事'],
      ['Codex / Skill', '边做边验证'],
      ['React 页面', '组件化交互'],
      ['在线作品集', '持续迭代发布'],
    ],
    href: 'https://github.com/Ai-luren/Ai-luren.github.io',
    linkLabel: 'GitHub 开源项目',
  },
];

function ExperimentCard({ item, slot, onSelect, cardRef }) {
  const isFeature = slot === 'feature';

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
      aria-label={`${isFeature ? '当前项目' : '切换到'}：${item.title}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="flip-experiment__meta">
        <span className="flip-experiment__number">{item.index}</span>
        <span className="flip-experiment__label">{item.label}</span>
      </div>
      <div className="flip-experiment__body">
        <div className="flip-experiment__copy">
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="flip-experiment__facts" aria-label="项目能力标签">
            {item.facts.map((fact) => <span key={fact}>{fact}</span>)}
          </div>
          <a
            className="flip-experiment__link"
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {item.linkLabel} <span aria-hidden="true">↗</span>
          </a>
        </div>
        {isFeature && (
          <div className="flip-experiment__workflow" aria-label={`${item.title}工作流`}>
            <span className="flip-experiment__workflow-title">WORKFLOW / 工作流</span>
            <ol>
              {item.workflow.map(([label, detail]) => (
                <li key={label}>
                  <span className="flip-experiment__workflow-node" aria-hidden="true" />
                  <span><strong>{label}</strong><small>{detail}</small></span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {!isFeature && <span className="flip-experiment__hint">点击切换</span>}
    </article>
    </GlareHover>
  );
}

export default function ExperimentFlip() {
  const rootRef = useRef(null);
  const cardRefs = useRef(new Map());
  const pendingFlipState = useRef(null);
  const [activeId, setActiveId] = useState(experiments[0].id);

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
    Flip.from(state, {
      duration: 0.48,
      ease: 'power3.inOut',
      absolute: false,
      scale: false,
      nested: true,
      clearProps: 'transform',
      onComplete: () => {
        // 切换完成后，feature 卡的 workflow 子元素分层落位
        const featureCard = rootRef.current?.querySelector('.flip-experiment__card.is-feature');
        if (!featureCard) return;
        const workflowEls = featureCard.querySelectorAll('.flip-experiment__workflow > *');
        if (workflowEls.length) {
          gsap.from(workflowEls, {
            autoAlpha: 0,
            y: 10,
            stagger: 0.06,
            duration: 0.4,
            ease: 'power2.out',
            delay: 0.18,
          });
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
    <div ref={rootRef} className="flip-experiment" aria-label="AI 实验项目切换台">
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
        当前查看：{experiments.find((item) => item.id === activeId)?.title}
      </div>
    </div>
  );
}
