import { useLang } from '../i18n/index.js';
import { HOME_HREF, WORKS_HREF } from '../navigation/links.js';

export default function DesktopPrimaryNavigation({ page = 'home' }) {
  const lang = useLang();
  const isLibrary = page === 'works';
  const homePath = isLibrary ? HOME_HREF : '';
  const homeLink = (id) => `${homePath}#${id}`;
  const workHref = isLibrary ? `${WORKS_HREF}${window.location.search}` : WORKS_HREF;
  const startsInImpact = !isLibrary && /^#impact-(awards|programs|reach)$/.test(window.location.hash);

  return <ul className="site-primary-nav" aria-label={lang === 'en' ? 'Primary navigation' : '主导航'}>
    <li><a className={isLibrary ? '' : 'is-active'} href={homeLink('projects')}>{lang === 'en' ? 'Featured' : '精选作品'}</a></li>
    <li><a className={isLibrary ? 'is-active' : ''} href={workHref}>{lang === 'en' ? 'All Work' : '全部作品'}</a></li>
    <li><a data-impact-nav="true" className={startsInImpact ? 'is-active' : ''} href={homeLink('impact-awards')}>{lang === 'en' ? 'Impact' : '影响力'}</a></li>
    <li><a href={homeLink('experiments')}>{lang === 'en' ? 'Lab' : '实验室'}</a></li>
    <li><a href={homeLink('contact')}>{lang === 'en' ? 'Contact' : '联系'}</a></li>
  </ul>;
}
