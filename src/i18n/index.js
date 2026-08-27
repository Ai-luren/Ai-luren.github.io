import { useEffect, useState } from 'react';
import { DICT } from './dictionary.js';

const STORAGE_KEY = 'ailuren-lang';
const listeners = new Set();

let currentLang = 'zh';
try {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'en') currentLang = 'en';
} catch (error) { /* localStorage 不可用时保持默认中文 */ }

function t(key) {
  return DICT[currentLang][key] ?? DICT.zh[key] ?? key;
}

function applyDictToDocument(lang) {
  const dict = DICT[lang];
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const value = dict[node.getAttribute('data-i18n')];
    if (value != null) node.textContent = value;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    const value = dict[node.getAttribute('data-i18n-aria')];
    if (value != null) node.setAttribute('aria-label', value);
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((node) => {
    const value = dict[node.getAttribute('data-i18n-alt')];
    if (value != null) node.setAttribute('alt', value);
  });

  document.documentElement.lang = dict['meta.htmlLang'];
  document.title = dict['meta.title'];
  document.querySelector('meta[name="description"]')?.setAttribute('content', dict['meta.description']);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', dict['meta.og.title']);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', dict['meta.og.description']);
  document.querySelector('meta[property="og:site_name"]')?.setAttribute('content', dict['meta.og.siteName']);
  document.querySelector('meta[property="og:locale"]')?.setAttribute('content', dict['meta.og.locale']);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', dict['meta.og.title']);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', dict['meta.twitter.description']);
}

function notifyScrollRefresh() {
  // 文案长度变化会影响 pin 住的章节高度，等 React 重渲染完成后再刷新测量。
  window.setTimeout(() => {
    if (window.ScrollTrigger?.refresh) window.ScrollTrigger.refresh();
  }, 140);
}

export function setLang(nextLang) {
  if (nextLang !== 'zh' && nextLang !== 'en') return;
  if (nextLang === currentLang) return;
  currentLang = nextLang;
  try { window.localStorage.setItem(STORAGE_KEY, nextLang); } catch (error) { /* 忽略写入失败 */ }
  applyDictToDocument(currentLang);
  window.__i18n = { lang: currentLang, t };
  listeners.forEach((listener) => listener(currentLang));
  notifyScrollRefresh();
}

export function toggleLang() {
  setLang(currentLang === 'zh' ? 'en' : 'zh');
}

export function getLang() {
  return currentLang;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 供 index.html 内联脚本使用的轻量翻译（如复制成功提示）。
window.__i18n = { lang: currentLang, t };

export function useLang() {
  const [lang, setLocalLang] = useState(currentLang);
  useEffect(() => subscribe(setLocalLang), []);
  return lang;
}

// 组件内一次性文案：t('中文', 'English')
export function useT() {
  const lang = useLang();
  return (zh, en) => (lang === 'en' ? en : zh);
}

function init() {
  applyDictToDocument(currentLang);
  document.getElementById('nav-lang')?.addEventListener('click', toggleLang);
}

init();
