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
  const [copyFailed, setCopyFailed] = useState(false);

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

  useEffect(() => { setCopied(false); setCopyFailed(false); }, [link?.href]);
  if (!link) return null;
  const contact = link.contactAction;
  const title = lang === 'en' ? 'Open external website?' : '即将前往站外网站';
  const destination = lang === 'en' ? (link.en || link.zh) : (link.zh || link.en);

  const contactTitle = contact === 'email'
    ? (lang === 'en' ? 'Contact by email' : '邮箱联系')
    : (lang === 'en' ? 'Connect on WeChat' : '微信联系');
  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(contact === 'email' ? link.address : link.wechatId);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
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
                <p className="external-link-sheet__contact-note">{lang === 'en' ? 'Scan with WeChat, or copy the ID and download the QR code below.' : '微信扫码添加，或复制微信号并下载二维码。'}</p>
              </>
            ) : (
              <>
                <p className="external-link-sheet__contact-note">{lang === 'en' ? 'Copy the email address to send a message in your mail app.' : '复制邮箱地址后，可在邮件应用中联系。'}</p>
              </>
            )}
            <div className="external-link-sheet__actions">
              {contact === 'wechat' ? (
                <a className="external-link-sheet__continue" href={link.href} download={link.download} onClick={copyContact}>
                  {copied ? (lang === 'en' ? 'ID copied · Check downloads' : '已复制微信号 · 请查看下载') : (lang === 'en' ? 'Copy ID & save QR code' : '复制并保存二维码')}
                </a>
              ) : (
                <button className="external-link-sheet__continue" type="button" onClick={copyContact}>
                  {copied ? (lang === 'en' ? 'Email copied' : '邮箱已复制') : (lang === 'en' ? 'Copy email address' : '复制邮箱地址')}
                </button>
              )}
              <button className="external-link-sheet__cancel" type="button" ref={cancelRef} onClick={onClose}>{lang === 'en' ? 'Stay in portfolio' : '留在作品集'}</button>
            </div>
            {copyFailed && <p className="external-link-sheet__copy-error" role="status">
              {lang === 'en' ? 'Copy failed. Please copy the contact from the portfolio.' : '复制未成功，请从作品集联系信息中手动复制。'}
            </p>}
          </>
        ) : <>
        <p className="external-link-sheet__eyebrow">{lang === 'en' ? 'EXTERNAL LINK' : '站外访问'}</p>
        <h2 id="external-link-title">{title}</h2>
        <p className="external-link-sheet__destination">{destination}</p>
        <div className="external-link-sheet__actions">
          <a className="external-link-sheet__continue" href={link.href} data-external-confirmed="true" target="_blank" rel="noopener noreferrer" onClick={onClose}>{lang === 'en' ? 'Continue to website' : '继续访问'}</a>
          <button className="external-link-sheet__cancel" type="button" ref={cancelRef} onClick={onClose}>{lang === 'en' ? 'Stay here' : '留在作品集'}</button>
        </div>
        </>}
      </div>
    </div>,
    document.body
  );
}
