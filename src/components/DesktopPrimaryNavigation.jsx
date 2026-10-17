import { useLang } from '../i18n/index.js';
import { HOME_HREF, WORKS_HREF } from '../navigation/links.js';

export default function DesktopPrimaryNavigation({ page = 'home' }) {
  const lang = useLang();
  const isLibrary = page === 'works';
  const homePath = isLibrary ? HOME_HREF : '';
  const homeLink = (id) => homePath + '#' + id;
  const workHref = isLibrary ? WORKS_HREF + window.location.search : WORKS_HREF;
  const initialHash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  const inExpertise = /^(recognition|experiments|impact-(awards|programs|reach))$/.test(initialHash);
  const inContact = /^(contact|profile)$/.test(initialHash);

  return <ul className="site-primary-nav" aria-label={lang === 'en' ? 'Primary navigation' : '主导航'}>
    <li><a className={!isLibrary && !inExpertise && !inContact ? 'is-active' : ''} href={homeLink('projects')}>{lang === 'en' ? 'Featured' : '精选作品'}</a></li>
    <li><a className={isLibrary ? 'is-active' : ''} href={workHref}>{lang === 'en' ? 'All Work' : '全部作品'}</a></li>
    <li><a data-impact-nav="true" className={!isLibrary && inExpertise ? 'is-active' : ''} href={homeLink('recognition')}>{lang === 'en' ? 'Expertise' : '专业实力'}</a></li>
    <li><a className={!isLibrary && inContact ? 'is-active' : ''} href={homeLink('contact')}>{lang === 'en' ? 'Contact' : '联系'}</a></li>
  </ul>;
}
