import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CinemaNavigation from './CinemaNavigation.jsx';
import { HOME_HREF, HOME_SECTIONS, WORKS_HREF } from '../navigation/links.js';
import DesktopPrimaryNavigation from './DesktopPrimaryNavigation.jsx';
import MobileMenuSocialLinks from './MobileMenuSocialLinks.jsx';
import ExternalLinkSheet, { useTouchExternalLink } from './ExternalLinkSheet.jsx';
import { DICT } from '../i18n/dictionary.js';

export default function LibraryNavigation({ lang }) {
  const [open, setOpen] = useState(false);
  const { pendingLink, closeLink, intercept } = useTouchExternalLink();
  const dialogRef = useRef(null), closeRef = useRef(null), triggerRef = useRef(null);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 761px)');
    const handleWideNavigation = () => {
      // The mobile-only dialog cannot survive an orientation/breakpoint change.
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener('change', handleWideNavigation);
    return () => wide.removeEventListener('change', handleWideNavigation);
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current.showModal();
    closeRef.current?.focus({preventScroll:true});
    return () => {
      document.body.style.overflow = overflow;
      const focusTarget = window.matchMedia('(min-width: 761px)').matches
        ? document.querySelector('.library-page-navigation .site-primary-nav a[href]')
        : triggerRef.current;
      focusTarget?.focus({preventScroll:true});
    };
  }, [open]);
  return <>
    <div className="library-page-navigation" style={open?{visibility:'hidden'}:undefined}>
      <CinemaNavigation lang={lang} menu closeRef={triggerRef} onClose={()=>setOpen(true)} homeReturn homeHref={HOME_HREF} label={lang==='en'?'Main navigation':'主导航'}>
        <DesktopPrimaryNavigation page="works" />
      </CinemaNavigation>
    </div>
    {open && createPortal(<dialog id="library-menu" className="library-menu" ref={dialogRef} onCancel={event=>{event.preventDefault();setOpen(false);}} aria-label={lang==='en'?'Main navigation':'主导航'} onKeyDown={event=>{
        if(event.key!=='Tab')return;
        const controls=[...event.currentTarget.querySelectorAll('a[href],button:not(:disabled)')];
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}>
      <CinemaNavigation lang={lang} closeRef={closeRef} onClose={()=>setOpen(false)} homeHref={HOME_HREF} label={lang==='en'?'Main navigation':'主导航'}/>
      <nav className="shared-menu-links mobile-menu__links" aria-label={lang==='en'?'Main navigation':'主导航'}>
        <ul className="nav-list">
          <li><a href={`${HOME_HREF}#projects`}><span>{lang==='en'?'Featured':'精选作品'}</span></a></li>
          <li><a className="is-active" aria-current="page" href={`${WORKS_HREF}${window.location.search}`}><span>{lang==='en'?'All Work':'全部作品'}</span></a></li>
          {HOME_SECTIONS.slice(1).map(section=><li key={section.id}><a href={`${HOME_HREF}#${section.id}`}><span>{section[lang]}</span></a></li>)}
        </ul>
      </nav>
      <div className="mobile-nav-drawer-foot mobile-menu__footer">
        <MobileMenuSocialLinks onExternalClick={(event, profile) => {
          if (intercept(event, { ...profile, opener: triggerRef.current })) setOpen(false);
        }} />
        <span className="mobile-menu__copyright">{DICT[lang]['footer.copyright']}</span>
      </div>
    </dialog>,document.body)}
    <ExternalLinkSheet link={pendingLink} onClose={closeLink} lang={lang} />
  </>;
}
