import { useLang } from '../i18n/index.js';
import './ExperimentFlip.css';

const experiments = [
  {
    id: 'news',
    index: '01',
    title: { zh: 'AI 新闻追踪', en: 'AI News Tracker' },
    description: { zh: '聚合多源 AI 资讯，飞书卡片定时推送并去重。', en: 'Aggregates AI news from multiple sources into deduped, scheduled Lark card updates.' },
    facts: [
      { zh: 'RSS 聚合', en: 'RSS aggregation' },
      { zh: '飞书卡片', en: 'Lark cards' },
      { zh: '定时推送', en: 'Scheduled delivery' },
    ],
    href: 'https://github.com/Ai-luren/Ainews-to-Feishu',
    linkLabel: { zh: 'GitHub', en: 'GitHub' },
  },
  {
    id: 'illustration',
    index: '02',
    title: { zh: 'AI 文章配图', en: 'AI Article Illustration' },
    description: { zh: '提取认知锚点，生成白底手绘风格正文配图。', en: 'Extracts cognitive anchors and generates clean hand-drawn style article illustrations.' },
    facts: [
      'Codex Skill',
      { zh: '16:9 配图', en: '16:9 visuals' },
      'Shot list',
    ],
    href: 'https://github.com/Ai-luren/Ailuren-illustrations',
    linkLabel: { zh: 'GitHub', en: 'GitHub' },
  },
  {
    id: 'compare',
    index: '03',
    title: { zh: '图片对比工具', en: 'Image Comparison Tool' },
    description: { zh: '把两张图放进同一画布，检查 AI 修图前后细节。', en: 'Compares before/after AI edits on one shared canvas, with synced zoom for detail review.' },
    facts: [
      { zh: '纯前端', en: 'Pure front-end' },
      'Before / After',
      { zh: '同步缩放', en: 'Sync zoom' },
    ],
    href: 'https://github.com/Ai-luren/Image-comparison',
    linkLabel: { zh: 'GitHub', en: 'GitHub' },
  },
];

const pick = (value, lang) => (typeof value === 'string' ? value : value[lang]);

export default function ExperimentFlip() {
  const lang = useLang();

  return (
    <div className="flip-experiment flip-experiment--editorial" aria-label={lang === 'en' ? 'AI lab projects' : 'AI 实验项目'}>
      <div className="flip-experiment__list">
        {experiments.map((item) => (
          <article className="flip-experiment__row" key={item.id} data-experiment-id={item.id}>
            <div className="flip-experiment__row-title">
              <h3>{pick(item.title, lang)}</h3>
            </div>
            <p className="flip-experiment__row-description">{pick(item.description, lang)}</p>
            <div className="flip-experiment__facts" aria-label={lang === 'en' ? 'Project capability tags' : '项目能力标签'}>
              {item.facts.map((fact) => <span key={pick(fact, lang)}>{pick(fact, lang)}</span>)}
            </div>
            <a
              className="flip-experiment__link"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {pick(item.linkLabel, lang)} <span aria-hidden="true">↗</span>
            </a>
          </article>
        ))}
      </div>
      <div className="flip-experiment__status" aria-live="polite">
        <span className="flip-experiment__status-dot" aria-hidden="true" />
        {lang === 'en' ? `${experiments.length} projects · more tools can be added` : `${experiments.length} 个项目 · 可继续添加更多工具`}
      </div>
    </div>
  );
}
