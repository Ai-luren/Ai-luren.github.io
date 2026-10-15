import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CinemaNavigation from './CinemaNavigation.jsx';
import { HOME_HREF, HOME_SECTIONS } from '../navigation/links.js';

export default function LibraryNavigation({ lang }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null), closeRef = useRef(null), triggerRef = useRef(null);
  useLayoutEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current.showModal();
    closeRef.current?.focus({preventScroll:true});
    return () => {
      document.body.style.overflow = overflow;
      triggerRef.current?.focus({preventScroll:true});
    };
  }, [open]);
  return <>
    <div className="library-page-navigation" style={open?{visibility:'hidden'}:undefined}>
      <CinemaNavigation lang={lang} menu closeRef={triggerRef} onClose={()=>setOpen(true)} homeHref={HOME_HREF} label={lang==='en'?'Main navigation':'主导航'}/>
    </div>
    {open && createPortal(<dialog id="library-menu" className="library-menu" ref={dialogRef} onCancel={event=>{event.preventDefault();setOpen(false);}} aria-label={lang==='en'?'Main navigation':'主导航'} onKeyDown={event=>{
        if(event.key!=='Tab')return;
        const controls=[...event.currentTarget.querySelectorAll('a[href],button:not(:disabled)')];
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}>
      <CinemaNavigation lang={lang} closeRef={closeRef} onClose={()=>setOpen(false)} homeHref={HOME_HREF} label={lang==='en'?'Main navigation':'主导航'}/>
      <div className="shared-menu-links">{HOME_SECTIONS.map(section=><a key={section.id} href={`${HOME_HREF}#${section.id}`}>{section[lang]}</a>)}</div>
    </dialog>,document.body)}
  </>;
}
