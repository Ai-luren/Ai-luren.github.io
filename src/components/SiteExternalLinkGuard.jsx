import { useEffect } from 'react';
import { useLang } from '../i18n/index.js';
import ExternalLinkSheet, { useTouchExternalLink } from './ExternalLinkSheet.jsx';

/**
 * Mobile external-link fallback for site sections that do not own a custom
 * action sheet. Existing dock/lab handlers preventDefault() first, so they
 * retain their branded labels and never open duplicate confirmation sheets.
 * Desktop external links continue to behave like ordinary browser anchors.
 */
export default function SiteExternalLinkGuard() {
  const lang = useLang();
  const { pendingLink, closeLink, intercept } = useTouchExternalLink();

  useEffect(() => {
    const onClick = event => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || anchor.dataset.externalConfirmed === 'true') return;
      // Event path remains reliable if an onClick handler has just closed its
      // own portalled sheet and detached the anchor before document bubbling.
      if (event.composedPath().some(node => node instanceof Element && node.classList.contains('external-link-sheet'))) return;

      let url;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === window.location.origin) return;
      const name = anchor.getAttribute('aria-label') || anchor.textContent.trim() || url.hostname;
      intercept(event, {
        href: url.href,
        zh: anchor.dataset.externalLabelZh || name,
        en: anchor.dataset.externalLabelEn || name,
        opener: anchor,
      });
    };
    // React click handlers on nested portals run before this native bubble
    // listener. They can opt out simply by preventing the default action.
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [intercept]);

  return <ExternalLinkSheet link={pendingLink} onClose={closeLink} lang={lang} />;
}
