import { setLang } from '../i18n/index.js';

// Shared B++ language control: used by the main header, library and all viewers.
// The active language is explicit; no extra click is needed to reveal EN.
export default function LanguageSwitch({ lang, className = '' }) {
  return <div className={['nav-language-switch', className].filter(Boolean).join(' ')}
    role="group" aria-label={lang === 'en' ? 'Language' : '语言'} data-active-lang={lang}>
    <span className="nav-language-switch__thumb" aria-hidden="true" />
    <button type="button" lang="zh-CN" data-switch-lang="zh"
      aria-pressed={lang === 'zh'} aria-label="中文" onClick={() => setLang('zh')}><span className="nav-language-switch__zh-long">中文</span><span className="nav-language-switch__zh-short" aria-hidden="true">中</span></button>
    <button type="button" lang="en" data-switch-lang="en"
      aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
  </div>;
}
