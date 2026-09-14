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
const VIEW_REDS = { zh: '小红书 ↗', en: 'RED ↗' };
const VIEW_DOUYIN = { zh: '抖音 ↗', en: 'Douyin ↗' };

const ARCHIVES = [
  { id: '01', platform: { zh: '01 / 小红书', en: '01 / RED' }, title: { zh: '屈臣氏 AI 品牌广告', en: 'Watsons AI Brand Ad' }, award: { zh: '优秀奖', en: 'Excellence Award' }, view: VIEW_REDS, cover: watsonsCover, href: 'https://www.xiaohongshu.com/discovery/item/688d99d1000000002203a643?source=webshare&xhsshare=pc_web&xsec_token=AB2HumoFo2_bj_DqZ4oAH4r0-H5GGEtHFUn9RIYEcCOv8=&xsec_source=pc_share' },
  { id: '02', platform: { zh: '02 / 小红书', en: '02 / RED' }, title: { zh: '联想 AI 品牌广告', en: 'Lenovo AI Brand Ad' }, award: { zh: '联想特别鸣谢奖', en: 'Lenovo Special Thanks' }, view: VIEW_REDS, cover: lenovoCover, href: 'https://www.xiaohongshu.com/discovery/item/684da8f8000000000c03a0e8?source=webshare&xhsshare=pc_web&xsec_token=AB4tZju6OcifF-7IglVCRs3XbtKen4Xwp6o5QSWw0Ltnk=&xsec_source=pc_share' },
  { id: '03', platform: { zh: '03 / 抖音', en: '03 / Douyin' }, title: { zh: '通义万相 AI 品牌广告', en: 'Wan AI Brand Ad' }, award: { zh: '通义官号首发', en: 'Featured by Tongyi Official' }, view: VIEW_DOUYIN, cover: tongyiCover, href: 'https://www.douyin.com/video/7533565207131131196' },
  { id: '04', platform: { zh: '04 / 小红书', en: '04 / RED' }, title: { zh: '霸王茶姬 AI 品牌广告', en: 'Chagee AI Brand Ad' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, view: VIEW_REDS, cover: chageeCover, href: 'https://www.xiaohongshu.com/discovery/item/6834a782000000000c03a3c1?source=webshare&xhsshare=pc_web&xsec_token=ABNgGVOpSb6RP8pGc_DcVAxOfnmMhtaK2TiKQoaJkZKIw=&xsec_source=pc_share' },
  { id: '05', platform: { zh: '05 / 小红书', en: '05 / RED' }, title: { zh: '宠物 AI 创意短片', en: 'Pet AI Short Film' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, view: VIEW_REDS, cover: catsCover, href: 'https://www.xiaohongshu.com/discovery/item/6858bb32000000002400ba58?source=webshare&xhsshare=pc_web&xsec_token=AB264App4J-oDzd1MVj8Vrc327aQZBjWlclryVOGFc1X8=&xsec_source=pc_share' },
  { id: '06', platform: { zh: '06 / 小红书', en: '06 / RED' }, title: { zh: '湖南 AI 文旅宣传', en: 'Hunan AI Travel Film' }, award: { zh: '超棒奖', en: 'Awesome Award' }, view: VIEW_REDS, cover: yueyangCover, href: 'https://www.xiaohongshu.com/discovery/item/68165055000000000e00525b?source=webshare&xhsshare=pc_web&xsec_token=ABDq1xQzCks5P83-ccrIgTlh_Pj6F4otf3gkmI-Y0Ugh0=&xsec_source=pc_share' },
  { id: '07', platform: { zh: '07 / 小红书', en: '07 / RED' }, title: { zh: '悠船 AI 创意短片', en: 'Midjourney AI Short Film' }, award: { zh: 'MJ 官方优秀作品', en: 'Midjourney Official Featured' }, view: VIEW_REDS, cover: riverCityCover, href: 'https://www.xiaohongshu.com/discovery/item/68b8051d000000001d00936f?source=webshare&xhsshare=pc_web&xsec_token=AB_COh4fY4yQq-A1yx_pOf7OadIS_o61EUSTaIJWvmwOU=&xsec_source=pc_share' },
  { id: '08', platform: { zh: '08 / 小红书', en: '08 / RED' }, title: { zh: '通义万相 AI 创意短片', en: 'Wan AI Short Film' }, award: { zh: '优秀奖', en: 'Excellence Award' }, view: VIEW_REDS, cover: lightCover, href: 'https://www.xiaohongshu.com/discovery/item/688f595c0000000023031b1e?source=webshare&xhsshare=pc_web&xsec_token=AB1dIKBSOCR_91FMS218sLjy66ZJrUFPjhjkxX0Dejau0=&xsec_source=pc_share' },
];

// 标题统一是「品牌 + AI + 类型」结构。在 " AI " 处切分成两段，
// 让桌面端自然成行、手机端也能在固定标题区内保持对齐。
const renderTitle = (raw) => {
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
  const touchState = useRef({ startX: 0, startY: 0, moved: false });
  const [canScroll, setCanScroll] = useState(false);
  const lang = useLang();

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchState.current = { startX: touch.clientX, startY: touch.clientY, moved: false };
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchState.current.startX);
    const dy = Math.abs(touch.clientY - touchState.current.startY);
    if (dx > 10 || dy > 10) touchState.current.moved = true;
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
    if (dragState.current.moved || touchState.current.moved) {
      event.preventDefault();
      dragState.current.moved = false;
      touchState.current.moved = false;
      return;
    }
  };

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

  return (
    <>
      <div ref={archiveRef} className="comet-archive" role="list" aria-label={lang === 'en' ? 'AI video work archive' : 'AI 视频创作档案'} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      {ARCHIVES.map(archive => (
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
            <span className="comet-archive__copy">
              <span className="comet-archive__details"><strong>{archive.award[lang]}</strong></span>
            </span>
          </a>
        </CometCard>
      ))}
      </div>
      {canScroll && <p className="comet-archive__scroll-hint" aria-hidden="true">{lang === 'en' ? 'Swipe to explore ' : '左右滑动查看更多 '}<span>→</span></p>}
    </>
  );
}
