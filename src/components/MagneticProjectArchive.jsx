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

const ARCHIVES = [
  { id: '01', title: { zh: '屈臣氏 AI 创意广告', en: 'Watsons AI Ad Campaign' }, category: { zh: 'AI 创意广告', en: 'Creative Ads' }, award: { zh: '优秀奖', en: 'Excellence Award' }, cover: watsonsCover, href: 'https://www.xiaohongshu.com/discovery/item/688d99d1000000002203a643?source=webshare&xhsshare=pc_web&xsec_token=AB2HumoFo2_bj_DqZ4oAH4r0-H5GGEtHFUn9RIYEcCOv8=&xsec_source=pc_share' },
  { id: '02', title: { zh: '联想 AI 创意广告', en: 'Lenovo AI Ad Campaign' }, category: { zh: 'AI 创意广告', en: 'Creative Ads' }, award: { zh: '联想特别鸣谢奖', en: 'Lenovo Special Thanks' }, cover: lenovoCover, href: 'https://www.xiaohongshu.com/discovery/item/684da8f8000000000c03a0e8?source=webshare&xhsshare=pc_web&xsec_token=AB4tZju6OcifF-7IglVCRs3XbtKen4Xwp6o5QSWw0Ltnk=&xsec_source=pc_share' },
  { id: '03', title: { zh: '通义万相先导片', en: 'Tongyi Wanxiang Teaser' }, category: { zh: 'AI 创意广告', en: 'Creative Ads' }, award: { zh: '通义官号首发', en: 'Featured by Tongyi Official' }, cover: tongyiCover, href: 'https://www.douyin.com/video/7533565207131131196' },
  { id: '04', title: { zh: '霸王茶姬 AI 创意广告', en: 'Chagee AI Ad Campaign' }, category: { zh: 'AI 创意广告', en: 'Creative Ads' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, cover: chageeCover, href: 'https://www.xiaohongshu.com/discovery/item/6834a782000000000c03a3c1?source=webshare&xhsshare=pc_web&xsec_token=ABNgGVOpSb6RP8pGc_DcVAxOfnmMhtaK2TiKQoaJkZKIw=&xsec_source=pc_share' },
  { id: '05', title: { zh: '猫咪的一天', en: "A Cat's Day" }, category: { zh: 'AI 创意短片', en: 'Short Films' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, cover: catsCover, href: 'https://www.xiaohongshu.com/discovery/item/6858bb32000000002400ba58?source=webshare&xhsshare=pc_web&xsec_token=AB264App4J-oDzd1MVj8Vrc327aQZBjWlclryVOGFc1X8=&xsec_source=pc_share' },
  { id: '06', title: { zh: '岳阳楼 AI 文旅宣传', en: 'Yueyang Tower AI Travel Film' }, category: { zh: 'AI 文旅宣传', en: 'Travel Promo' }, award: { zh: '超棒奖·优秀奖', en: 'Awesome Award · Excellence Award' }, cover: yueyangCover, href: 'https://www.xiaohongshu.com/discovery/item/68165055000000000e00525b?source=webshare&xhsshare=pc_web&xsec_token=ABDq1xQzCks5P83-ccrIgTlh_Pj6F4otf3gkmI-Y0Ugh0=&xsec_source=pc_share' },
  { id: '07', title: { zh: '人河流城市', en: 'People, River, City' }, category: { zh: 'AI 概念短片', en: 'Concepts' }, award: { zh: 'MJ 官方优秀作品', en: 'Midjourney Official Featured' }, cover: riverCityCover, href: 'https://www.xiaohongshu.com/discovery/item/68b8051d000000001d00936f?source=webshare&xhsshare=pc_web&xsec_token=AB_COh4fY4yQq-A1yx_pOf7OadIS_o61EUSTaIJWvmwOU=&xsec_source=pc_share' },
  { id: '08', title: { zh: '光', en: 'Light' }, category: { zh: 'AI 概念短片', en: 'Concepts' }, award: { zh: '还不错奖·优秀奖', en: 'Not Bad Award · Excellence Award' }, cover: lightCover, href: 'https://www.xiaohongshu.com/discovery/item/688f595c0000000023031b1e?source=webshare&xhsshare=pc_web&xsec_token=AB1dIKBSOCR_91FMS218sLjy66ZJrUFPjhjkxX0Dejau0=&xsec_source=pc_share' },
];

export default function MagneticProjectArchive() {
  const archiveRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const lastTapRef = useRef({ time: 0, href: '' });
  const [canScroll, setCanScroll] = useState(false);
  const lang = useLang();

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
    if (Math.abs(distance) > 6) {
      if (!state.moved) {
        state.moved = true;
        archive.setPointerCapture?.(event.pointerId);
      }
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

  const handleCardClick = (event, href) => {
    event.preventDefault();
    if (dragState.current.moved) {
      dragState.current.moved = false;
      return;
    }
    // 移动端（触屏设备）需要双击才跳转，避免滑动时误触
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) {
      const now = Date.now();
      if (now - lastTapRef.current.time < 350 && lastTapRef.current.href === href) {
        lastTapRef.current.time = 0;
        window.open(href, '_blank', 'noopener,noreferrer');
      } else {
        lastTapRef.current = { time: now, href };
      }
      return;
    }
    // 桌面端单击即跳转
    window.open(href, '_blank', 'noopener,noreferrer');
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
      <div ref={archiveRef} className="comet-archive" role="list" aria-label={lang === 'en' ? 'AI video work archive' : 'AI 视频创作档案'} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging}>
      {ARCHIVES.map(archive => (
        <CometCard key={archive.id} className="comet-archive__item" onClick={(event) => handleCardClick(event, archive.href)}>
          <a
            className="comet-archive__card"
            href={archive.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={lang === 'en' ? `${archive.title.en} · ${archive.award.en} — click to view` : `${archive.title.zh}，${archive.award.zh}，点击查看作品`}
            style={{ '--comet-cover': `url(${archive.cover})` }}
          >
            <span className="comet-archive__glass" aria-hidden="true" />
            <span className="comet-archive__image" aria-hidden="true" />
            <span className="comet-archive__award">WORK / {archive.category[lang]}</span>
            <span className="comet-archive__copy">
              <span className="comet-archive__meta">{archive.id} / AWARD</span>
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
