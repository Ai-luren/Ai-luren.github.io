import CometCard from './CometCard.jsx';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/index.js';
import watsonsCover from '../../assets/images/project-covers/AI 创意广告-屈臣氏（优秀奖）.webp';
import lenovoCover from '../../assets/images/project-covers/AI 创意广告-联想（联想特别鸣谢奖_官号转发）.webp';
import tongyiCover from '../../assets/images/project-covers/AI 创意广告-通义万相先导片（官号首发）.webp';
import chageeCover from '../../assets/images/project-covers/AI 创意广告-霸王茶姬（中国联通三等奖）.webp';
import catsCover from '../../assets/images/project-covers/AI 创意短片-猫咪的一天（中国联通三等奖）.webp';
import yueyangCover from '../../assets/images/project-covers/AI 文旅宣传-岳阳楼（优秀奖_超棒奖）.webp';
import riverCityCover from '../../assets/images/project-covers/AI 概念短片-人河流城市（MJ 官方优秀作品）.webp';
import lightCover from '../../assets/images/project-covers/AI 概念短片-光（通义光引-还不错奖｜通义生动-优秀奖）.webp';
import './CometCard.css';

// viewLabel 按链接实际平台标注，避免「小红书观看」指向抖音链接。
const VIEW_REDS = { zh: '跳转 ↗', en: 'JUMP ↗' };
const VIEW_DOUYIN = { zh: '跳转 ↗', en: 'JUMP ↗' };

const ARCHIVES = [
  { id: '01', platform: { zh: '01 / 小红书', en: '01 / RED' }, title: { zh: '屈臣氏 AI 品牌广告', en: 'Watsons AI Brand Ad' }, award: { zh: '优秀奖', en: 'Excellence Award' }, view: VIEW_REDS, cover: watsonsCover, href: 'https://www.xiaohongshu.com/discovery/item/688d99d1000000002203a643?source=webshare&xhsshare=pc_web&xsec_token=AB2HumoFo2_bj_DqZ4oAH4r0-H5GGEtHFUn9RIYEcCOv8=&xsec_source=pc_share' },
  { id: '02', platform: { zh: '02 / 小红书', en: '02 / RED' }, title: { zh: '联想 AI 品牌广告', en: 'Lenovo AI Brand Ad' }, award: { zh: '联想特别鸣谢奖', en: 'Lenovo Special Thanks' }, view: VIEW_REDS, cover: lenovoCover, href: 'https://www.xiaohongshu.com/discovery/item/684da8f8000000000c03a0e8?source=webshare&xhsshare=pc_web&xsec_token=AB4tZju6OcifF-7IglVCRs3XbtKen4Xwp6o5QSWw0Ltnk=&xsec_source=pc_share' },
  { id: '03', platform: { zh: '03 / 抖音', en: '03 / Douyin' }, title: { zh: '通义万相 AI 品牌广告', en: 'Wan AI Brand Ad' }, award: { zh: '通义官号首发', en: 'Featured by Tongyi Official' }, view: VIEW_DOUYIN, cover: tongyiCover, href: 'https://www.douyin.com/video/7533565207131131196' },
  { id: '04', platform: { zh: '04 / 小红书', en: '04 / RED' }, title: { zh: '霸王茶姬 AI 品牌广告', en: 'Chagee AI Brand Ad' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, view: VIEW_REDS, cover: chageeCover, href: 'https://www.xiaohongshu.com/discovery/item/6834a782000000000c03a3c1?source=webshare&xhsshare=pc_web&xsec_token=ABNgGVOpSb6RP8pGc_DcVAxOfnmMhtaK2TiKQoaJkZKIw=&xsec_source=pc_share' },
  { id: '05', platform: { zh: '05 / 小红书', en: '05 / RED' }, title: { zh: '宠物 AI 创意短片', en: 'Pet AI Short Film' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, view: VIEW_REDS, cover: catsCover, href: 'https://www.xiaohongshu.com/discovery/item/6858bb32000000002400ba58?source=webshare&xhsshare=pc_web&xsec_token=AB264App4J-oDzd1MVj8Vrc327aQZBjWlclryVOGFc1X8=&xsec_source=pc_share' },
  { id: '06', platform: { zh: '06 / 小红书', en: '06 / RED' }, title: { zh: '湖南 AI 文旅宣传', en: 'Hunan AI Travel Film' }, award: { zh: '超棒奖', en: 'Awesome Award' }, view: VIEW_REDS, cover: yueyangCover, href: 'https://www.xiaohongshu.com/discovery/item/68165055000000000e00525b?source=webshare&xhsshare=pc_web&xsec_token=ABDq1xQzCks5P83-ccrIgTlh_Pj6F4otf3gkmI-Y0Ugh0=&xsec_source=pc_share' },
  { id: '07', platform: { zh: '07 / 小红书', en: '07 / RED' }, title: { zh: '悠船 AI 创意短片', en: 'Midjourney AI Short Film' }, award: { zh: 'MJ 官方优秀作品', en: 'Midjourney Official Featured' }, view: VIEW_REDS, cover: riverCityCover, href: 'https://www.xiaohongshu.com/discovery/item/68b8051d000000001d00936f?source=webshare&xhsshare=pc_web&xsec_token=AB_COh4fY4yQq-A1yx_pOf7OadIS_o61EUSTaIJWvmwOU=&xsec_source=pc_share' },
  { id: '08', platform: { zh: '08 / 小红书', en: '08 / RED' }, title: { zh: '通义万相 AI 创意短片', en: 'WAN AI Short Film' }, award: { zh: '优秀奖', en: 'Excellence Award' }, view: VIEW_REDS, cover: lightCover, href: 'https://www.xiaohongshu.com/discovery/item/688f595c0000000023031b1e?source=webshare&xhsshare=pc_web&xsec_token=AB1dIKBSOCR_91FMS218sLjy66ZJrUFPjhjkxX0Dejau0=&xsec_source=pc_share' },
];

// 标题统一是「品牌 + AI + 类型」结构。在 " AI " 处切分成两段，
// 让桌面端自然成行、手机端也能在固定标题区内保持对齐。
const renderTitle = (raw) => {
  if (raw === 'WAN AI Short Film') return <span className="comet-archive__title-content">{raw}</span>;
  const idx = raw.indexOf(' AI ');
  if (idx === -1) return <span className="comet-archive__title-content">{raw}</span>;
  return (
    <span className="comet-archive__title-content">
      <span className="comet-archive__title-line">{raw.slice(0, idx)}</span>
      {' '}
      <span className="comet-archive__title-line">{raw.slice(idx + 1)}</span>
    </span>
  );
};

export default function MagneticProjectArchive() {
  const archiveRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const touchState = useRef({ startX: 0, startY: 0, moved: false, axis: 'none', pageAtStart: 0, suppressClickUntil: 0 });
  const pageTransitionTimer = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  ));
  const [mobilePage, setMobilePage] = useState(0);
  const [mobilePageTransition, setMobilePageTransition] = useState('');
  const lang = useLang();

  const rubberBand = (distance, atBoundary) => (atBoundary ? distance * .35 : distance);

  const resetTouchVisual = (animate = true) => {
    const archive = archiveRef.current;
    if (!archive) return;
    archive.classList.toggle('is-touch-dragging', !animate);
    archive.style.setProperty('--mobile-swipe-x', '0px');
  };

  const changeMobilePage = (nextPage, direction) => {
    const safePage = Math.max(0, Math.min(1, nextPage));
    if (safePage === mobilePage) return;
    window.clearTimeout(pageTransitionTimer.current);
    setMobilePageTransition(direction < 0 ? 'back' : 'forward');
    setMobilePage(safePage);
    pageTransitionTimer.current = window.setTimeout(() => setMobilePageTransition(''), 380);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchState.current = { startX: touch.clientX, startY: touch.clientY, moved: false, axis: 'none', pageAtStart: mobilePage, suppressClickUntil: 0 };
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchState.current.startX;
    const dy = touch.clientY - touchState.current.startY;
    const distanceX = Math.abs(dx);
    const distanceY = Math.abs(dy);
    if (distanceX > 10 || distanceY > 10) {
      touchState.current.moved = true;
      if (touchState.current.axis === 'none') {
        touchState.current.axis = distanceX > distanceY ? 'horizontal' : 'vertical';
      }
    }
    if (touchState.current.axis === 'horizontal' && archiveRef.current) {
      const atBoundary = (touchState.current.pageAtStart === 0 && dx > 0)
        || (touchState.current.pageAtStart === 1 && dx < 0);
      archiveRef.current.classList.add('is-touch-dragging');
      archiveRef.current.style.setProperty('--mobile-swipe-x', `${rubberBand(dx, atBoundary)}px`);
    }
  };

  const handleTouchEnd = (event) => {
    if (!isMobile) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const distanceX = touch.clientX - touchState.current.startX;
    const distanceY = touch.clientY - touchState.current.startY;
    const isHorizontalSwipe = touchState.current.axis === 'horizontal'
      && Math.abs(distanceX) > 42
      && Math.abs(distanceX) > Math.abs(distanceY);
    if (isHorizontalSwipe) {
      touchState.current.suppressClickUntil = Date.now() + 450;
      resetTouchVisual(true);
      changeMobilePage(touchState.current.pageAtStart + (distanceX < 0 ? 1 : -1), distanceX);
    } else if (touchState.current.moved) {
      touchState.current.suppressClickUntil = Date.now() + 250;
      resetTouchVisual(true);
    }
  };

  const handleTouchCancel = () => {
    resetTouchVisual(true);
    touchState.current = { startX: 0, startY: 0, moved: false, axis: 'none', pageAtStart: mobilePage, suppressClickUntil: 0 };
  };

  useEffect(() => () => window.clearTimeout(pageTransitionTimer.current), []);

  const handlePageKeyDown = (event) => {
    if (!isMobile) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    changeMobilePage(mobilePage + (event.key === 'ArrowRight' ? 1 : -1), event.key === 'ArrowRight' ? 1 : -1);
  };

  const handleTouchEnd = (event) => {
    if (!isMobile) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const distance = touch.clientX - touchState.current.startX;
    if (Math.abs(distance) > 42) {
      setMobilePage((page) => Math.max(0, Math.min(1, page + (distance < 0 ? 1 : -1))));
    }
  };

  const handlePageKeyDown = (event) => {
    if (!isMobile) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setMobilePage((page) => Math.max(0, Math.min(1, page + (event.key === 'ArrowRight' ? 1 : -1))));
  };

  const handlePointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const archive = archiveRef.current;
    if (!archive) return;
    dragState.current = { active: true, startX: event.clientX, startScrollLeft: archive.scrollLeft, moved: false };
    archive.classList.add('is-dragging');
  };

  const handlePointerMove = (event) => {
    const archive = archiveRef.current;
    const state = dragState.current;
    if (!archive || !state.active) return;
    const distance = event.clientX - state.startX;
    if (Math.abs(distance) <= 10) return;
    if (!state.moved) {
      state.moved = true;
      archive.setPointerCapture?.(event.pointerId);
    }
    archive.scrollLeft = state.startScrollLeft - distance;
  };

  const stopDragging = (event) => {
    const archive = archiveRef.current;
    if (!archive) return;
    if (dragState.current.moved && event?.pointerId != null) {
      archive.releasePointerCapture?.(event.pointerId);
    }
    dragState.current.active = false;
    archive.classList.remove('is-dragging');
  };

  const handleCardClick = (event) => {
    // 滑动（鼠标拖拽或触屏位移）后松手不触发跳转；干净的点击走原生 <a> 跳转
    if (dragState.current.moved || touchState.current.moved || Date.now() < touchState.current.suppressClickUntil) {
      event.preventDefault();
      dragState.current.moved = false;
      touchState.current = { startX: 0, startY: 0, moved: false, axis: 'none', pageAtStart: mobilePage, suppressClickUntil: 0 };
      return;
    }
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const updateViewport = () => setIsMobile(media.matches);
    updateViewport();
    media.addEventListener?.('change', updateViewport);
    return () => media.removeEventListener?.('change', updateViewport);
  }, []);

  useEffect(() => {
    const archive = archiveRef.current;
    if (!archive) return undefined;
    const updateScrollHint = () => {
      setCanScroll(archive.scrollWidth - archive.clientWidth - archive.scrollLeft > 8);
    };
    updateScrollHint();
    archive.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint, { passive: true });
    return () => {
      archive.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, []);

  const visibleArchives = isMobile ? ARCHIVES.slice(mobilePage * 4, mobilePage * 4 + 4) : ARCHIVES;
  const mobilePreviousDisabled = mobilePage === 0;
  const mobileNextDisabled = mobilePage === 1;

  return (
    <>
      <div className={`comet-archive-mobile-shell${mobilePageTransition ? ` is-page-${mobilePageTransition}` : ''}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel}>
      <button className="comet-archive-page-arrow comet-archive-page-arrow--prev" type="button" aria-label={lang === 'en' ? 'Previous project page' : '上一页作品'} disabled={!isMobile || mobilePreviousDisabled} onClick={() => changeMobilePage(mobilePage - 1, -1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 5-7 7 7 7" /></svg>
      </button>
      <div key={isMobile ? mobilePage : 'desktop'} ref={archiveRef} className="comet-archive" role="list" aria-label={lang === 'en' ? 'AI video work archive' : 'AI 视频创作档案'} tabIndex={isMobile ? 0 : undefined} onKeyDown={handlePageKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging}>
      {visibleArchives.map(archive => (
        <CometCard key={archive.id} className="comet-archive__item" enableTilt={false} onClick={handleCardClick}>
          <a
            className="comet-archive__card"
            href={archive.href}
            aria-label={lang === 'en' ? `${archive.title.en} · ${archive.award.en}, click to view` : `${archive.title.zh}，${archive.award.zh}，点击查看作品`}
            style={{ '--comet-cover': `url(${archive.cover})` }}
          >
            <strong className="comet-archive__title">{renderTitle(archive.title[lang])}</strong>
            <span className="comet-archive__image">
              <span className="comet-archive__meta" aria-hidden="true">{archive.view[lang]}</span>
            </span>
            <span className="comet-archive__mobile-link" aria-hidden="true">{archive.view[lang]}</span>
            <span className="comet-archive__copy">
              <span className="comet-archive__details"><strong>{archive.award[lang]}</strong></span>
            </span>
          </a>
        </CometCard>
      ))}
      </div>
      <button className="comet-archive-page-arrow comet-archive-page-arrow--next" type="button" aria-label={lang === 'en' ? 'Next project page' : '下一页作品'} disabled={!isMobile || mobileNextDisabled} onClick={() => changeMobilePage(mobilePage + 1, 1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m8.5 5 7 7-7 7" /></svg>
      </button>
      <div className="comet-archive-pagination" role="tablist" aria-label={lang === 'en' ? 'Select project page' : '选择作品页'}>
        {[0, 1].map((page) => (
        <button key={page} type="button" role="tab" aria-selected={isMobile && mobilePage === page} aria-label={lang === 'en' ? `Show project page ${page + 1}` : `查看第${page + 1}页作品`} className={isMobile && mobilePage === page ? 'is-active' : ''} onClick={() => changeMobilePage(page, page > mobilePage ? 1 : -1)} />
        ))}
      </div>
      </div>
      {canScroll && <p className="comet-archive__scroll-hint" aria-hidden="true">{lang === 'en' ? 'Swipe to explore ' : '左右滑动查看更多 '}<span>→</span></p>}
    </>
  );
}
