import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/index.js';
import { PROJECTS, PROJECT_CATEGORIES, FEATURED_PROJECTS } from '../data/projects.js';
import ProjectCard from './ProjectCard.jsx';
import CinemaPlayer from './CinemaPlayer.jsx';
import LibraryNavigation from './LibraryNavigation.jsx';
import { prepareProjectPoster, warmImage } from '../utils/warmImage.js';
import './WorksLibrary.css';

// The All Work page uses the four real category tabs, never a redundant All filter.
const DEFAULT_CATEGORY = 'commercial';
const MOBILE_CATEGORY_LABELS = {
  commercial: { zh: '商业广告', en: 'Ads' },
  'short-film': { zh: '创意短片', en: 'Films' },
  social: { zh: '海外产品', en: 'Product Ads' },
  visual: { zh: '视觉实验', en: 'Visuals' },
};

export default function WorksLibrary() {
  const lang = useLang();
  const [category, setCategory] = useState(() => {
    const query = new URLSearchParams(location.search);
    const watchProject = PROJECTS.find(item => item.id === query.get('watch'));
    if (watchProject) return watchProject.category;
    const initial = query.get('category');
    return PROJECT_CATEGORIES.some(item => item.id === initial) ? initial : DEFAULT_CATEGORY;
  });
  const [selected, setSelected] = useState(null);
  const cinemaReturnFocusRef = useRef(null);
  const selectionTokenRef = useRef(0);
  const initialWatchRef = useRef(new URLSearchParams(location.search).get('watch'));

  const activeCategory = PROJECT_CATEGORIES.find(item => item.id === category);
  const visible = PROJECTS.filter(project => project.category === category);
  const directProjectId = new URLSearchParams(location.search).get('project');
  // Prioritize the actual library grid, not the homepage Featured flag.
  // Keep the priority tiers accurate after phone rotation or desktop resizing.
  const columnsForViewport = () => matchMedia('(min-width: 1280px)').matches ? 4
    : matchMedia('(min-width: 900px)').matches ? 3 : 2;
  const [firstRowCount, setFirstRowCount] = useState(columnsForViewport);
  useEffect(() => {
    const update = () => setFirstRowCount(columnsForViewport());
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);
  const warmCategoryFirstRow = nextCategory => {
    if (nextCategory === category) return;
    PROJECTS.filter(project => project.category === nextCategory).slice(0, 2)
      .forEach(project => warmImage(project.cover));
  };

  // Direct preview from Studio opens the right category and finds the exact card.
  useEffect(() => {
    const id=new URLSearchParams(location.search).get('project');
    if(!id || !visible.some(project=>project.id===id))return undefined;
    let timeout;
    const raf=requestAnimationFrame(()=>{
      const target=document.querySelector('.library-grid .comet-archive__card[data-project-id="'+id+'"]');
      if(!target)return;
      target.classList.add('library-preview-target');
      target.scrollIntoView({block:'center',behavior:'instant'});
      target.focus({preventScroll:true});
      timeout=setTimeout(()=>target.classList.remove('library-preview-target'),4000);
    });
    return ()=>{cancelAnimationFrame(raf);clearTimeout(timeout);};
  },[category]);

  useEffect(() => {
    document.title = lang === 'en' ? 'All Work · Ai Luren' : '全部作品 · AI路人';
    document.querySelector('meta[name="description"]')?.setAttribute('content', lang === 'en' ? 'AI commercials, short films, product and social media ads, and visual experiments by Ai Luren.' : 'AI路人的 AI 商业广告、创意短片、海外产品广告、视觉实验作品库。');
    // Keep metadata consistent when switching languages without reloading the page.
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', lang === 'en' ? 'All Work · Ai Luren | AI Video Portfolio' : '全部作品 · AI路人｜AI 影像与创意作品');
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', lang === 'en' ? 'Explore AI commercials, short films, product ads and visual experiments by Ai Luren.' : '浏览 AI路人的 AI 商业广告、创意短片、社媒与 UGC 广告及视觉实验，观看完整影片。');
    document.querySelector('meta[property="og:site_name"]')?.setAttribute('content', lang === 'en' ? 'Ai Luren Portfolio' : 'AI路人作品集');
    document.querySelector('meta[property="og:image:alt"]')?.setAttribute('content', lang === 'en' ? 'Ai Luren — AI video creator portfolio' : 'AI路人 · AI 视频创意设计师作品集');
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', lang === 'en' ? 'en_US' : 'zh_CN');
  }, [lang]);
  useEffect(() => {
    const url = new URL(location.href);
    if (category === DEFAULT_CATEGORY) url.searchParams.delete('category'); else url.searchParams.set('category', category);
    history.replaceState(history.state, '', url);
  }, [category]);

  // The workbench's "view this work" link points to one project, not the
  // default first category. It selects the right category, then scrolls to
  // and briefly highlights the actual card without opening/playing a video.
  useEffect(() => {
    const url = new URL(location.href);
    const id = url.searchParams.get('project');
    if (!id) return;
    const project = PROJECTS.find(item => item.id === id);
    if (!project) {
      url.searchParams.delete('project');
      history.replaceState(null, '', url);
      return;
    }
    if (category !== project.category) {
      setCategory(project.category);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const card = [...document.querySelectorAll('.library-grid .comet-archive__card')]
        .find(item => item.dataset.projectId === id);
      if (!card) return;
      card.scrollIntoView({behavior:'instant',block:'center'});
      card.focus({preventScroll:true});
      card.dataset.directHighlight = 'true';
      url.searchParams.delete('project');
      history.replaceState(null, '', url);
      setTimeout(() => { if (card.isConnected) delete card.dataset.directHighlight; },2400);
    });
    return () => cancelAnimationFrame(frame);
  }, [category]);

  // Shareable playback uses ?watch=ID, separate from Studio's existing
  // ?project=ID card highlight. The initial link receives a synthetic local
  // base entry: Back closes the film, Forward reopens it, without leaving the
  // portfolio or accidentally replaying the background video.
  useEffect(() => {
    const initialId = initialWatchRef.current;
    if (!initialId) return;
    const project = PROJECTS.find(item => item.id === initialId);
    if (!project) {
      const clean = new URL(location.href);
      clean.searchParams.delete('watch');
      history.replaceState(history.state, '', clean);
      initialWatchRef.current = null;
      return;
    }
    if (category !== project.category) { setCategory(project.category); return; }
    // React StrictMode deliberately replays mount effects. Build this history
    // pair exactly once, but allow the second effect to restart poster decoding.
    if (!history.state?.portfolioWatch) {
      const entry = new URL(location.href);
      const baseEntry = new URL(entry);
      baseEntry.searchParams.delete('watch');
      history.replaceState({ ...history.state, portfolioWatchBase: true }, '', baseEntry);
      history.pushState({ portfolioWatch: true }, '', entry);
    }
    const token = ++selectionTokenRef.current;
    const trigger = [...document.querySelectorAll('.library-grid .comet-archive__card')]
      .find(node => node.dataset.projectId === project.id);
    cinemaReturnFocusRef.current = trigger || null;
    // After closing a shared film, the exact source card—not the unrelated
    // first row—must be visible and ready to receive restored keyboard focus.
    trigger?.scrollIntoView({ block: 'center', behavior: 'instant' });
    void prepareProjectPoster(project).then(prepared => {
      if (token === selectionTokenRef.current &&
          new URLSearchParams(location.search).get('watch') === project.id) {
        initialWatchRef.current = null;
        setSelected(prepared);
      }
    });
  }, [category]);

  useEffect(() => {
    const onPopState = () => {
      const id = new URLSearchParams(location.search).get('watch');
      const project = PROJECTS.find(item => item.id === id);
      const token = ++selectionTokenRef.current;
      if (!project) { setSelected(null); return; }
      setCategory(project.category);
      const trigger = [...document.querySelectorAll('.library-grid .comet-archive__card')]
        .find(node => node.dataset.projectId === project.id);
      cinemaReturnFocusRef.current = trigger || null;
      trigger?.scrollIntoView({ block: 'center', behavior: 'instant' });
      void prepareProjectPoster(project).then(prepared => {
        if (token === selectionTokenRef.current) setSelected(prepared);
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openSharedWork = (project, trigger) => {
    const token = ++selectionTokenRef.current;
    cinemaReturnFocusRef.current = trigger;
    void prepareProjectPoster(project).then(prepared => {
      if (token !== selectionTokenRef.current || !trigger?.isConnected) return;
      const url = new URL(location.href);
      url.searchParams.set('watch', project.id);
      history.pushState({ portfolioWatch: true }, '', url);
      setSelected(prepared);
    });
  };
  const selectSharedWork = project => {
    if (new URLSearchParams(location.search).has('watch')) {
      const url = new URL(location.href);
      url.searchParams.set('watch', project.id);
      history.replaceState({ ...history.state, portfolioWatch: true }, '', url);
    }
    setSelected(project);
  };
  const closeSharedWork = () => {
    if (new URLSearchParams(location.search).has('watch')) {
      if (history.state?.portfolioWatch) { history.back(); return; }
      const url = new URL(location.href);
      url.searchParams.delete('watch');
      history.replaceState(history.state, '', url);
    }
    setSelected(null);
  };

  return <div className="work-library">
    <a className="library-skip" href="#library-main">{lang === 'en' ? 'Skip to work' : '跳到作品'}</a>
    <div className="library-shell">
      {!selected && <LibraryNavigation lang={lang} />}
      <div className="library-nav-space" />
      <main id="library-main">
        <div className="library-intro"><h1 className="page-title">{lang === 'en' ? 'All Work' : '全部作品'}</h1><p>{lang === 'en' ? `${PROJECTS.length} Works · ${activeCategory?.label.en || 'Category'} (${visible.length})` : `共 ${PROJECTS.length} 部作品 · 当前：${activeCategory?.label.zh || '分类'} ${visible.length} 部`}</p></div>
        <div className="library-filters" role="group" aria-label={lang === 'en' ? 'Filter work by category' : '按作品类别筛选'}>
          {PROJECT_CATEGORIES.map(item => <button type="button" key={item.id} data-category={item.id} aria-pressed={category === item.id}
            onPointerEnter={() => warmCategoryFirstRow(item.id)}
            onPointerDownCapture={() => warmCategoryFirstRow(item.id)}
            onFocus={() => warmCategoryFirstRow(item.id)}
            onClick={() => { selectionTokenRef.current++; setCategory(item.id); }}><span className="library-filter-label">{item.label[lang]}</span><span className="library-filter-short">{MOBILE_CATEGORY_LABELS[item.id][lang]}</span><span className="library-filter-count">{PROJECTS.filter(project => project.category === item.id).length}</span></button>)}
        </div>
        <p className="library-category-note" aria-live="polite" aria-atomic="true">
          {activeCategory?.description?.[lang] || '\u00a0'}
        </p>
        {visible.length ? <div className="library-grid" role="list" aria-label={lang === 'en' ? 'All projects' : '全部项目'}>{visible.map((project, index) => <ProjectCard key={project.id} project={project} lang={lang}
          coverPriority={project.id === directProjectId || index < firstRowCount ? 'high' : index < firstRowCount * 2 ? 'normal' : 'low'}
          deferUntilNear={index >= firstRowCount * 2 && project.id !== directProjectId} onClick={(event, item) => {
          const trigger = event.target.closest('.comet-archive__card');
          openSharedWork(item, trigger);
        }} />)}</div>
          : <div className="library-empty"><p>{lang === 'en' ? 'No work in this category yet.' : '该分类暂未收录作品'}</p><button type="button" onClick={() => setCategory(DEFAULT_CATEGORY)}>{lang === 'en' ? 'View commercials' : '查看商业广告'}</button></div>}
      </main>
    </div>
    <CinemaPlayer key={selected ? 'open' : 'closed'} project={selected} projects={visible} allProjects={PROJECTS} featuredProjects={FEATURED_PROJECTS} returnFocusRef={cinemaReturnFocusRef} onSelect={selectSharedWork} context="library" onClose={closeSharedWork} />
  </div>;
}
