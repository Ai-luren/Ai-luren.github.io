import { toggleLang } from '../i18n/index.js';
import { DICT } from '../i18n/dictionary.js';
import avatar from '../../assets/images/ai-luren-avatar.webp';

// The same capsule geometry also styles the static home header. Modal controls
// live inside their own layer, so the underlying page remains inaccessible.
export default function CinemaNavigation({ lang, closeRef, navRef, onClose, menu = false, homeHref, label, children }) {
  const brand = <><img src={avatar} alt="" /><span>{DICT[lang]['brand.name']}</span></>;
  return <nav className="cinema-player__navigation" aria-label={label || (lang==='en'?'Cinema navigation':'影院导航')} ref={navRef}>
    {homeHref ? <a className="cinema-player__brand" href={homeHref} aria-label={lang==='en'?'Back to home':'返回首页'}>{brand}</a> : <div className="cinema-player__brand">{brand}</div>}
    {children}
    <button type="button" className="cinema-player__language" onClick={toggleLang} aria-label={lang==='en'?'Switch to Chinese':'切换英文'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.8"/><path d="M3.8 12h16.4M12 3.2c4.4 4.8 4.4 12.8 0 17.6-4.4-4.8-4.4-12.8 0-17.6Z"/></svg>
    </button>
    <button className="cinema-player__close" type="button" ref={closeRef} onClick={onClose} aria-haspopup={menu?'dialog':undefined} aria-expanded={menu?false:undefined} aria-controls={menu?'library-menu':undefined} aria-label={menu?(lang==='en'?'Open navigation':'展开主导航'):(lang==='en'?'Close viewer':'关闭查看器')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{menu?<path d="M4 8h16M4 16h16"/>:<path d="m6 6 12 12M18 6 6 18"/>}</svg>
    </button>
  </nav>;
}
