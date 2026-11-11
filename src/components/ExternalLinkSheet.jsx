import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ExternalLinkSheet.css';

// A small touch-only confirmation surface, not another site navigation.
// Original links remain ordinary URLs; confirming is a native user-initiated link.
export function useTouchExternalLink() {
  const [pendingLink, setPendingLink] = useState(null);
  const closeLink = useCallback(() => setPendingLink(null), []);
  const isTouchSurface = () => window.matchMedia?.('(hover: none), (pointer: coarse)').matches ?? false;
  const intercept = (event, link) => {
    if (!isTouchSurface() || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    event.preventDefault();
    setPendingLink(link);
    return true;
  };
  return { pendingLink, closeLink, intercept };
}

export default function ExternalLinkSheet({ link, onClose, lang }) {
  const cancelRef = useRef(null);
  const openerRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!link) return undefined;
    openerRef.current = link.opener?.isConnected ? link.opener : document.activeElement;
    const dialog = document.querySelector('.external-link-sheet');
    const background = [...document.body.children].filter(node => node !== dialog && !node.contains(dialog));
    const previousInert = background.map(node => node.inert);
    const previousOverflow = document.body.style.overflow;
    background.forEach(node => { node.inert = true; });
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('a[href],button:not(:disabled)')];
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      background.forEach((node, i) => { node.inert = previousInert[i]; });
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.({ preventScroll: true });
    };
  }, [link, onClose]);

  useEffect(() => { setCopied(false); }, [link?.href]);
  if (!link) return null;
  const contact = link.contactAction;
  const domain = contact ? null : new URL(link.href).hostname.replace(/^www\./, '');
  const isGitHub = domain === 'github.com';
  const title = lang === 'en' ? 'Open external website?' : '即将前往站外网站';
  const destination = lang === 'en' ? (link.en || link.zh) : (link.zh || link.en);

  const contactTitle = contact === 'email'
    ? (lang === 'en' ? 'Contact by email' : '邮箱联系')
    : (lang === 'en' ? 'Connect on WeChat' : '微信联系');
  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(contact === 'email' ? link.address : link.wechatId);
      setCopied(true);
    } catch { setCopied(false); }
  };

  return createPortal(
    <div className="external-link-sheet" role="dialog" aria-modal="true" aria-labelledby="external-link-title" onClick={event => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="external-link-sheet__panel">
        <span className="external-link-sheet__handle" aria-hidden="true" />
        {contact ? (
          <>
            <p className="external-link-sheet__eyebrow">{lang === 'en' ? 'CONTACT' : '联系方式'}</p>
            <h2 id="external-link-title">{contactTitle}</h2>
            {contact === 'wechat' ? (
              <>
                <div className="external-link-sheet__qr"><img src={link.href} alt={lang === 'en' ? 'WeChat QR code' : '微信联系二维码'} width="200" height="200" /></div>
                <p className="external-link-sheet__contact-note">{lang === 'en' ? 'Scan with another device, or copy the WeChat ID below.' : '可使用另一台设备扫码，或复制微信号后在微信中搜索添加。'}</p>
                <p className="external-link-sheet__contact-value">{link.wechatId}</p>
              </>
            ) : (
              <>
                <p className="external-link-sheet__contact-note">{lang === 'en' ? 'Copy the address or open your email app to write a message.' : '可以复制邮箱地址，或打开邮件应用发送邮件。'}</p>
                <p className="external-link-sheet__contact-value">{link.address}</p>
              </>
            )}
            <div className="external-link-sheet__actions">
              <button className="external-link-sheet__continue" type="button" onClick={copyContact}>{copied ? (lang === 'en' ? (contact === 'email' ? 'Email copied' : 'WeChat ID copied') : (contact === 'email' ? '邮箱已复制' : '微信号已复制')) : (lang === 'en' ? (contact === 'email' ? 'Copy email address' : 'Copy WeChat ID') : (contact === 'email' ? '复制邮箱地址' : '复制微信号'))}</button>
              {contact === 'email' ? (
                <a className="external-link-sheet__cancel" href={link.href} onClick={onClose}>{lang === 'en' ? 'Open mail app' : '打开邮件应用'}</a>
              ) : (
                <a className="external-link-sheet__cancel" href={link.href} download={link.download}>{lang === 'en' ? 'Save QR image' : '保存二维码图片'}</a>
              )}
              <button className="external-link-sheet__dismiss" type="button" ref={cancelRef} onClick={onClose}>{lang === 'en' ? 'Close' : '关闭'}</button>
            </div>
          </>
        ) : <>
        <p className="external-link-sheet__eyebrow">{lang === 'en' ? 'EXTERNAL LINK' : '站外访问'}</p>
        <h2 id="external-link-title">{title}</h2>
        <p className="external-link-sheet__destination">{destination}</p>
        <p className="external-link-sheet__domain">{domain}</p>
        {isGitHub && <p className="external-link-sheet__hint">{lang === 'en' ? 'GitHub may load slowly on some networks. You can copy the address to open it later.' : '部分网络环境下 GitHub 可能加载较慢，可先复制链接备用'}</p>}
        <div className="external-link-sheet__actions">
          <a className="external-link-sheet__continue" href={link.href} data-external-confirmed="true" target="_blank" rel="noopener noreferrer" onClick={onClose}>{lang === 'en' ? 'Continue to website' : '继续访问'}</a>
          <button className="external-link-sheet__cancel" type="button" ref={cancelRef} onClick={onClose}>{lang === 'en' ? 'Stay here' : '留在作品集'}</button>
        </div>
        {isGitHub && <button type="button" className="external-link-sheet__copy" onClick={async () => {
          try { await navigator.clipboard.writeText(link.href); setCopied(true); }
          catch { setCopied(false); }
        }}>{copied ? (lang === 'en' ? 'Link copied' : '已复制链接') : (lang === 'en' ? 'Copy link instead' : '复制 GitHub 链接')}</button>}
        </>}
      </div>
    </div>,
    document.body
  );
}
