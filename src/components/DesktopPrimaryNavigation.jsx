import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/index.js';
import { HOME_HREF, WORKS_HREF } from '../navigation/links.js';

const IMPACT_SECTIONS = [
  { id: 'impact-awards', zh: 'AI 获奖荣誉', en: 'AI Awards & Recognition' },
  { id: 'impact-programs', zh: 'AI 平台超创', en: 'AI Platform Creators' },
  { id: 'impact-reach', zh: 'AI 自媒体', en: 'AI Social Media' },
];

export default function DesktopPrimaryNavigation({ page = 'home' }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const isLibrary = page === 'works';
  const homePath = isLibrary ? HOME_HREF : '';
  const homeLink = (id) => `${homePath}#${id}`;
  const workHref = isLibrary ? `${WORKS_HREF}${window.location.search}` : WORKS_HREF;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return <ul className="site-primary-nav" ref={rootRef} aria-label={lang === 'en' ? 'Primary navigation' : '主导航'}>
    <li><a className={isLibrary ? '' : 'is-active'} href={homeLink('projects')}>{lang === 'en' ? 'Featured' : '精选作品'}</a></li>
    <li><a className={isLibrary ? 'is-active' : ''} href={workHref}>{lang === 'en' ? 'All Work' : '全部作品'}</a></li>
    <li><a href={homeLink('profile')}>{lang === 'en' ? 'Career' : '经历'}</a></li>
    <li className="site-primary-nav__impact">
      <button type="button" ref={triggerRef} data-impact-trigger aria-expanded={open} aria-controls="desktop-impact-submenu" onClick={() => setOpen(value => !value)}>
        {lang === 'en' ? 'Impact' : '影响力'}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4" /></svg>
      </button>
      {open && <div className="site-primary-nav__submenu" id="desktop-impact-submenu">
        {IMPACT_SECTIONS.map((section) => <a key={section.id} href={homeLink(section.id)} onClick={() => setOpen(false)}>{section[lang]}</a>)}
      </div>}
    </li>
    <li><a href={homeLink('experiments')}>{lang === 'en' ? 'Lab' : '实验室'}</a></li>
    <li><a href={homeLink('contact')}>{lang === 'en' ? 'Contact' : '联系'}</a></li>
  </ul>;
}
