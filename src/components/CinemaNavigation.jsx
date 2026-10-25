import LanguageSwitch from './LanguageSwitch.jsx';
import { DICT } from '../i18n/dictionary.js';
import avatar from '../../assets/images/ai-luren-avatar.webp';

// The same capsule geometry also styles the static home header. Modal controls
// live inside their own layer, so the underlying page remains inaccessible.
export default function CinemaNavigation({ lang, closeRef, navRef, onClose, menu = false, homeHref, label, children }) {
  const brand = <><img src={avatar} alt="" /><span className="cinema-player__brand-name">{DICT[lang]['brand.name']}</span>
    {homeHref && <span className="cinema-player__brand-home">{lang === 'en' ? '← Home' : '← 首页'}</span>}</>;
  return <nav className="cinema-player__navigation" aria-label={label || (lang==='en'?'Cinema navigation':'影院导航')} ref={navRef}>
    {homeHref ? <a className="cinema-player__brand" href={homeHref} aria-label={lang==='en'?'Back to home':'返回首页'}>{brand}</a> : <div className="cinema-player__brand">{brand}</div>}
    {children}
    <LanguageSwitch lang={lang} className="cinema-player__language" />
    <button className="cinema-player__close" type="button" ref={closeRef} onClick={onClose} aria-haspopup={menu?'dialog':undefined} aria-expanded={menu?false:undefined} aria-controls={menu?'library-menu':undefined} aria-label={menu?(lang==='en'?'Open navigation':'展开主导航'):(lang==='en'?'Close viewer':'关闭查看器')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{menu?<path d="M4 8h16M4 16h16"/>:<path d="m6 6 12 12M18 6 6 18"/>}</svg>
    </button>
  </nav>;
}
