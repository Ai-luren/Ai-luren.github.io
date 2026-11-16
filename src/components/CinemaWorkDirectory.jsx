import { PROJECT_CATEGORIES } from '../data/projects.js';
import { projectVideoVersions, initialProjectPoster } from '../data/version-order.js';
import { warmImage } from '../utils/warmImage.js';
import './CinemaWorkDirectory.css';

// The player directory is a reading surface inside the EXISTING cinema dialog,
// never a second modal. Different works and A/B/C versions remain separate.
const SCOPE_LABELS = {
  all: { zh: '全部作品', en: 'All Work' },
  featured: { zh: '精选作品', en: 'Featured' },
};
// Match the existing Works page's short English category labels on compact
// surfaces instead of truncating 'Visual Experiments' at 320px.
const DIRECTORY_CATEGORY_EN = { commercial: 'Ads', 'short-film': 'Films', social: 'Product Ads', visual: 'Visuals' };
const listIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;

export { listIcon as cinemaDirectoryIcon };

export default function CinemaWorkDirectory({ lang, allProjects, featuredProjects, activeProjectId,
  scope, filter, onFilter, busyProjectId, onChoose, onClose, trapFocus, panelRef }) {
  const categories = [
    { id: 'all', label: SCOPE_LABELS.all[lang], count: allProjects.length },
    { id: 'featured', label: SCOPE_LABELS.featured[lang], count: featuredProjects.length },
    ...PROJECT_CATEGORIES.map(category => ({
      id: category.id,
      label: lang === 'en' ? DIRECTORY_CATEGORY_EN[category.id] : category.label.zh,
      count: allProjects.filter(project => project.category === category.id).length,
    })),
  ];
  const listed = filter === 'all' ? allProjects : filter === 'featured' ? featuredProjects
    : allProjects.filter(project => project.category === filter);
  const activeLabel = categories.find(category => category.id === scope)?.label || SCOPE_LABELS.all[lang];
  const renderFilter = entry => <button key={entry.id} type="button" className="cinema-directory__filter"
    data-scope={entry.id} aria-pressed={filter === entry.id} disabled={Boolean(busyProjectId)}
    onClick={() => onFilter(entry.id)}>
    <span>{entry.label}</span><span className="cinema-directory__filter-count">{entry.count}</span>
  </button>;
  const getFormat = project => {
    const version = projectVideoVersions(project)[0];
    const ratio = (version?.videoWidth || 16) / (version?.videoHeight || 9);
    return ratio > 2.1 ? '21:9' : ratio < .72 ? '9:16' : ratio < 1.2 ? '4:3' : '16:9';
  };
  const getMeta = project => {
    const category = PROJECT_CATEGORIES.find(item => item.id === project.category)?.label?.[lang] || '';
    const versions = projectVideoVersions(project);
    return [category, getFormat(project), versions.length > 1
      ? lang === 'en' ? `${versions.length} versions` : `${versions.length} 个版本` : ''].filter(Boolean).join(' · ');
  };
  // Only compact modal sheets trap Tab; the wide-screen sidecar is nonmodal.
  const keepFocusInside = event => {
    if (!trapFocus || event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };
  return <>
    <div className="cinema-directory__scrim" aria-hidden="true" onClick={onClose} />
    <aside className="cinema-directory" id="cinema-work-directory" ref={panelRef}
      role="region" aria-label={lang === 'en' ? 'Browse portfolio works' : '浏览作品目录'}
      onKeyDown={keepFocusInside}>
      <div className="cinema-directory__grab" aria-hidden="true" />
      <div className="cinema-directory__header">
        <div>
          <h3>{lang === 'en' ? 'Work Directory' : '作品目录'}</h3>
          <p>{lang === 'en' ? `Current range: ${activeLabel}` : `当前浏览范围：${activeLabel}`}</p>
        </div>
        <button type="button" className="cinema-directory__close" onClick={onClose}
          aria-label={lang === 'en' ? 'Close work directory' : '关闭作品目录'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="cinema-directory__filters" aria-label={lang === 'en' ? 'Filter works' : '筛选作品'}>
        <div className="cinema-directory__filter-grid cinema-directory__filter-grid--scope" role="group" aria-label={lang === 'en' ? 'All or featured' : '全部与精选'}>
          {categories.slice(0, 2).map(renderFilter)}
        </div>
        <div className="cinema-directory__filter-grid cinema-directory__filter-grid--categories" role="group" aria-label={lang === 'en' ? 'Work categories' : '作品分类'}>
          {categories.slice(2).map(renderFilter)}
        </div>
      </div>
      <div className="cinema-directory__list" role="group" aria-label={lang === 'en' ? 'Select a work' : '选择作品'}>
        {listed.map(project => {
          const isCurrent = project.id === activeProjectId;
          return <button type="button" key={project.id} className="cinema-directory__item"
            data-project-id={project.id} aria-current={isCurrent ? 'true' : undefined}
            aria-busy={busyProjectId === project.id} disabled={Boolean(busyProjectId)}
            onPointerEnter={() => warmImage(initialProjectPoster(project))}
            onFocus={() => warmImage(initialProjectPoster(project))}
            onClick={() => onChoose(project)}>
            <img src={project.cover} alt="" loading="lazy" decoding="async" />
            <span className="cinema-directory__item-description">
              <span className="cinema-directory__item-title">{project.title[lang]}</span>
              <span className="cinema-directory__item-meta">{getMeta(project)}</span>
            </span>
            {isCurrent && <span className="cinema-directory__now">{lang === 'en' ? 'Current' : '当前'}</span>}
          </button>;
        })}
      </div>
      <div className="cinema-directory__footer">
        <p>{lang === 'en'
          ? `${listed.length} works · Selecting a work opens the poster without autoplay`
          : `共 ${listed.length} 部作品 · 选择后展示海报，不自动播放`}</p>
      </div>
    </aside>
  </>;
}
