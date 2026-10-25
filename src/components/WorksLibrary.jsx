import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/index.js';
import { PROJECTS, PROJECT_CATEGORIES } from '../data/projects.js';
import ProjectCard from './ProjectCard.jsx';
import CinemaPlayer from './CinemaPlayer.jsx';
import LibraryNavigation from './LibraryNavigation.jsx';
import { HOME_HREF } from '../navigation/links.js';
import './WorksLibrary.css';

const MOBILE_CATEGORY_LABELS = {
  all: { zh: '全部', en: 'All' },
  commercial: { zh: '商业广告', en: 'Ads' },
  'short-film': { zh: '创意短片', en: 'Films' },
  social: { zh: '海外产品', en: 'Overseas' },
  visual: { zh: '视觉实验', en: 'Visuals' },
};

export default function WorksLibrary() {
  const lang = useLang();
  const [category, setCategory] = useState(() => {
    const initial = new URLSearchParams(location.search).get('category');
    return PROJECT_CATEGORIES.some(item => item.id === initial) ? initial : 'all';
  });
  const [selected, setSelected] = useState(null);
  const cinemaReturnFocusRef = useRef(null);
  const activeCategory = PROJECT_CATEGORIES.find(item => item.id === category);
  const visible = category === 'all' ? PROJECTS : PROJECTS.filter(project => project.category === category);

  useEffect(() => {
    document.title = lang === 'en' ? 'All Work · AI路人' : '全部作品 · AI路人';
    document.querySelector('meta[name="description"]')?.setAttribute('content', lang === 'en' ? 'AI commercials, short films, overseas product ads and visual experiments by AI路人.' : 'AI路人的 AI 商业广告、创意短片、海外产品广告、视觉实验作品库。');
  }, [lang]);
  useEffect(() => {
    const url = new URL(location.href);
    if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', category);
    history.replaceState(null, '', url);
  }, [category]);

  return <div className="work-library">
    <a className="library-skip" href="#library-main">{lang === 'en' ? 'Skip to work' : '跳到作品'}</a>
    <div className="library-shell">
      {!selected && <LibraryNavigation lang={lang} />}
      <div className="library-nav-space" />
      <main id="library-main">
        <div className="library-intro"><a className="library-back" href={`${HOME_HREF}#projects`}>{lang==='en'?'← Selected work':'← 返回精选作品'}</a><h1 className="page-title">{lang === 'en' ? 'All Work' : '全部作品'}</h1><p>{lang === 'en' ? `${PROJECTS.length} projects · AI moving image & creative work` : `${PROJECTS.length} 个项目 · AI 影像与创意作品库`}</p></div>
        <div className="library-filters" role="group" aria-label={lang === 'en' ? 'Filter work by category' : '按作品类别筛选'}>
          {PROJECT_CATEGORIES.map(item => <button type="button" key={item.id} data-category={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}><span className="library-filter-label">{item.label[lang]}</span><span className="library-filter-short">{MOBILE_CATEGORY_LABELS[item.id][lang]}</span><span className="library-filter-count">{item.id === 'all' ? PROJECTS.length : PROJECTS.filter(project => project.category === item.id).length}</span></button>)}
        </div>
        <p className="library-category-note" aria-live="polite" aria-atomic="true">
          {activeCategory?.description?.[lang] || '\u00a0'}
        </p>
        {visible.length ? <div className="library-grid" role="list" aria-label={lang === 'en' ? 'All projects' : '全部项目'}>{visible.map(project => <ProjectCard key={project.id} project={project} lang={lang} onClick={(event, item) => {
          cinemaReturnFocusRef.current = event.target.closest('.comet-archive__card');
          setSelected(item);
        }} />)}</div>
          : <div className="library-empty"><p>{lang === 'en' ? 'No work in this category yet.' : '该分类暂未收录作品'}</p><button type="button" onClick={() => setCategory('all')}>{lang === 'en' ? 'View all work' : '查看全部作品'}</button></div>}
      </main>
    </div>
    <CinemaPlayer key={selected ? 'open' : 'closed'} project={selected} projects={visible} returnFocusRef={cinemaReturnFocusRef} onSelect={setSelected} context="library" onClose={() => setSelected(null)} />
  </div>;
}
