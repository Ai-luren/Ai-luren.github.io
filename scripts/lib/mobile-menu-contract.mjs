// Home and Works share a single mobile drawer contract; layout-specific
// and interactive assertions stay in their owning tests.
import assert from 'node:assert/strict';

export function assertMobileMenuContract({
  label, lang, width, height, overlay, links, socialCount, socialHeading,
  headerVisible, horizontalOverflow, footer,
}) {
  assert.equal(overlay,'rgba(12, 12, 13, 0.97)',label+': shared scrim');
  assert.equal(links.length,4,label+': four navigation links');
  assert.equal(socialCount,4,label+': four social links');
  assert.equal(socialHeading,lang==='en'?'Social':'社交平台',label+': bilingual social title');
  assert(headerVisible,label+': original navigation stays visible');
  assert(horizontalOverflow<=2,label+': no horizontal overflow');
  assert(links.every((r,i)=>r.left>=0&&r.right<=width &&
    (i===0||r.top>=links[i-1].bottom)),label+': navigation links fit without overlap');
  assert(footer.top>=links.at(-1).bottom+8,label+': footer follows links');
  assert(footer.bottom<=height-8,label+': footer fits viewport');
}
