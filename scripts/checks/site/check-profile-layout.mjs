// Prevent regression of the final About / Contact composition.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const browser=await chromium.launch({
  executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless:true,
});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
try{
  for(const width of [320,390,720,744,760,761,1024,1440]){
    for(const lang of ['zh','en']){
      const page=await createSafePage(browser,{viewport:{width,height:900}});
      const tag=width+'px '+lang;
      try{
        await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
        await page.goto(new URL('index.html#profile',base).href,{waitUntil:'domcontentloaded'});
        await page.locator('#profile .closing-card').scrollIntoViewIfNeeded();
        await page.waitForTimeout(560); // Allow the existing GSAP reveal to settle
        const state=await page.evaluate(()=>{
          const get=q=>document.querySelector(q);
          const bounds=el=>el.getBoundingClientRect();
          const role=get('#profile-title'),contact=get('#contact-title'),
            brand=get('#profile .closing-footer'),dock=get('#footer-dock-react-root');
          const links=[...get('#profile .footer-contact-direct').querySelectorAll('a')];
          const icons=[...dock.querySelectorAll('.floating-dock-item')];
          const visible=el=>getComputedStyle(el).display!=='none';
          return {
            roleText:role.textContent.trim(),contactText:contact.textContent.trim(),
            roleSize:getComputedStyle(role).fontSize,
            contactSize:getComputedStyle(contact).fontSize,
            headingDelta:Math.abs(bounds(role).top-bounds(contact).top),
            brandVisible:visible(brand),
            socialCount:icons.length,
            socialRowSpread:Math.max(...icons.map(el=>bounds(el).top))-
              Math.min(...icons.map(el=>bounds(el).top)),
            staleLabels:get('#profile .closing-column-kicker, #profile .footer-contact-kicker')!==null,
            headingCount:get('#profile .closing-card').querySelectorAll('h2').length,
            aboutRoleCount:get('#profile .about-role').querySelectorAll('h3').length,
            cardOverflow:bounds(get('#profile .closing-card')).right>innerWidth+1,
            horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
            links:links.map(a=>({href:a.getAttribute('href'),text:a.textContent.trim()})),
            profileLabel:get('#profile').getAttribute('aria-labelledby'),
            contactLabel:get('#contact').getAttribute('aria-labelledby'),
            copyText:get('#profile .about-description').textContent.trim(),
          };
        });
        assert.equal(state.roleSize,state.contactSize,tag+': headline sizes differ');
        assert(width<=720||state.headingDelta<1,tag+': two desktop headings not aligned');
        assert.equal(state.brandVisible,width>760,tag+': repeated phone signature visible');
        assert.equal(state.socialCount,6,tag+': incomplete social dock');
        assert(state.socialRowSpread<=2,tag+': social icons not on one row');
        assert.equal(state.staleLabels,false,tag+': redundant section labels returned');
        assert.equal(state.headingCount,2,tag+': two peer headings required');
        assert(state.horizontalOverflow<=2&&!state.cardOverflow,tag+': horizontal clipping');
        assert.equal(state.profileLabel,'profile-title');
        assert.equal(state.contactLabel,'contact-title');
        assert(state.links.some(l=>l.href?.startsWith('mailto:')),tag+': email link missing');
        assert(state.links.some(l=>l.href==='#copy-wechat'),tag+': WeChat copy target missing');
        assert(state.copyText.length>40,tag+': biography description missing');
        assert.equal(getSafeMediaReport(page).urls.length,0,tag+': unexpected CDN media');
        console.log('PASS '+tag+': equal headings, single-row social dock, intact contact actions');
      }finally{await page.close();}
    }
  }
  console.log('PASS profile composition: 8 widths × 2 languages');
}finally{await browser.close()}
