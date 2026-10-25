import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CinemaNavigation from './CinemaNavigation.jsx';
import { HOME_HREF, HOME_SECTIONS, WORKS_HREF } from '../navigation/links.js';
import DesktopPrimaryNavigation from './DesktopPrimaryNavigation.jsx';

export default function LibraryNavigation({ lang }) {
  const [open, setOpen] = useState(false);
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
      <div className="shared-menu-links">
        {HOME_SECTIONS.slice(0, 1).map(section=><a key={section.id} href={`${HOME_HREF}#${section.id}`}>{section[lang]}</a>)}
        <a href={`${WORKS_HREF}${window.location.search}`}>{lang==='en'?'All Work':'全部作品'}</a>
        {HOME_SECTIONS.slice(1).map(section=><a key={section.id} href={`${HOME_HREF}#${section.id}`}>{section[lang]}</a>)}
      </div>
    </dialog>,document.body)}
  </>;
}
