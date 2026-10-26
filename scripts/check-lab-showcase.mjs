import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

// Lab details must be a one-viewport proof viewer, not a scrollable README.
// Test authentic project screenshots, 16:9 illustrations, and the real comparison-app demo.
const b=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
const origin=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
try {
  for (const [width,height,lang] of [[320,568,'zh'],[375,667,'zh'],[390,844,'zh'],[390,844,'en'],[744,1133,'zh'],[820,1180,'en'],[912,1368,'zh'],[1024,768,'en'],[1440,900,'zh'],[1440,900,'en']]) {
    const p=await createSafePage(b,{viewport:{width,height},hasTouch:width<800});
    await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(origin+'index.html#experiments',{waitUntil:'domcontentloaded'});
    await p.locator('.flip-experiment__detail').first().click();
    const viewer=p.locator('.lab-project-lightbox');await viewer.waitFor({state:'visible'});
    const dialog=p.locator('.lab-project-dialog');
    const heights=[];
    for(let i=0;i<3;i++){
      if(i>0){
        await dialog.locator('.lab-project-pagination button').last().click();
        await p.waitForFunction(idx=>document.querySelector('.lab-project-pagination span')?.textContent.includes((idx+1)+' / 3'),i);
      }
      const measurements=await dialog.evaluate(e=>{
        const modal=e.getBoundingClientRect(),viewer=document.querySelector('.lab-project-lightbox');
        const frame=e.querySelector('.lab-project-image-frame').getBoundingClientRect();
        const image=e.querySelector('.lab-project-image-canvas img').getBoundingClientRect();
        const footer=e.querySelector('.lab-project-footer').getBoundingClientRect();
        const pager=e.querySelector('.lab-project-pagination').getBoundingClientRect();
        const arrows=[...e.querySelectorAll('.lab-project-pagination button svg')].map(svg=>{
          const a=svg.getBoundingClientRect(),b=svg.parentElement.getBoundingClientRect();
          return {dx:Math.abs((a.left+a.width/2)-(b.left+b.width/2)),dy:Math.abs((a.top+a.height/2)-(b.top+b.height/2))};
        });
        const css=getComputedStyle(viewer);const expectedTop=parseFloat(css.paddingTop)+(innerHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)-modal.height)/2;return {height:modal.height,top:modal.top,bottom:modal.bottom,viewport:innerHeight,expectedTop,modalScroll:e.scrollHeight-e.clientHeight,viewerScroll:viewer.scrollHeight-viewer.clientHeight,pageOverflow:document.documentElement.scrollWidth-innerWidth,footerBottom:footer.bottom,pagerBottom:pager.bottom,imageInFrame:image.width<=frame.width+1&&image.height<=frame.height+1,arrows};
      });
      heights.push(measurements.height);
      assert(measurements.top>=0&&measurements.bottom<=height+1,JSON.stringify(measurements));
      assert(Math.abs(measurements.top-measurements.expectedTop)<2,'Lab viewer must be centered in available space below nav: '+JSON.stringify(measurements));
      assert(measurements.modalScroll<=2&&measurements.viewerScroll<=2,JSON.stringify(measurements));
      assert(measurements.pageOverflow<=2,JSON.stringify(measurements));
      assert(measurements.pagerBottom<=measurements.bottom&&measurements.footerBottom<=measurements.bottom,JSON.stringify(measurements));
      assert(measurements.imageInFrame,JSON.stringify(measurements));
      assert(measurements.arrows.every(x=>x.dx<1&&x.dy<1),JSON.stringify(measurements));
      assert((await dialog.locator('.lab-project-image-canvas img').first().evaluate(x=>x.naturalWidth))>0,'preview decoded');
      assert.equal(await dialog.locator('.lab-project-pagination button svg').count(),2);
      if(i===0) {
        assert.equal(await dialog.locator('.lab-project-image-tabs button').count(),3);
        const thumbnails = await dialog.locator('.lab-project-image-tabs button').evaluateAll(buttons => buttons.map(button => {
          const border = button.getBoundingClientRect();
          const image = button.querySelector('img').getBoundingClientRect();
          const slack = .5;
          return {
            buttonWidth: border.width, buttonHeight: border.height,
            imageInside: image.left >= border.left-slack && image.top >= border.top-slack && image.right <= border.right+slack && image.bottom <= border.bottom+slack,
            clipped: getComputedStyle(button).overflow === 'hidden'
          };
        }));
        assert(thumbnails.every(item => item.imageInside && item.clipped), 'Thumbnail images must stay inside rounded card: ' + JSON.stringify(thumbnails));
        assert(thumbnails.every(item => Math.abs(item.buttonWidth-thumbnails[0].buttonWidth) < 1 && Math.abs(item.buttonHeight-thumbnails[0].buttonHeight) < 1), 'News thumbnails must share identical dimensions');
      }
      if(i===1) assert.equal(await dialog.locator('.lab-project-image-tabs button').count(),4);
      if(i===2) {
        assert.equal(await dialog.locator('.lab-project-image-tabs button').count(),0);
        assert.equal(await dialog.locator('.lab-project-image-canvas img').count(),1);
        assert((await dialog.locator('.lab-project-image-canvas img').first().getAttribute('src')).includes('live-showcase'));
        const showcase = await dialog.locator('.lab-project-image-canvas img').first().evaluate(img => ({width: img.naturalWidth, height: img.naturalHeight}));
        assert(showcase.width === 960 && showcase.height === 700, 'single comparison showcase should be a balanced 960x700 real UI composite');
        assert.equal(await dialog.locator('.lab-project-showcase-count').count(),0,'single image should not show 1 / 1');
      }
      if(i===2) assert.equal(await dialog.locator('.lab-project-source--primary').getAttribute('href'),'https://ai-luren.github.io/Image-comparison/');
    }
    assert(Math.max(...heights)-Math.min(...heights)<1,'All three project cards must use the same height: '+heights);
    await p.keyboard.press('ArrowLeft');
    await p.waitForFunction(()=>document.querySelector('.lab-project-pagination span')?.textContent.includes('2 / 3'));
    await dialog.locator('.lab-project-image-tabs button').last().click();
    await p.waitForFunction(()=>document.querySelector('.lab-project-image-canvas img')?.getAttribute('src')?.includes('08-trust-bridge'));
    assert.equal(getSafeMediaReport(p).urls.length,0);
    assert.deepEqual(errors,[]);
    await p.keyboard.press('Escape');
    await viewer.waitFor({state:'detached'});
    console.log('PASS:',width+'×'+height,lang,'3 equal-height cards, no scroll/clipping, live demo and aligned arrows');
    await p.close();
  }
}finally{await b.close()}
