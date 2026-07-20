import CometCard from './CometCard.jsx';
import { useEffect, useRef, useState } from 'react';
import watsonsCover from '../../AI作品集封面/AI 创意广告-屈臣氏（优秀奖）.jpg';
import lenovoCover from '../../AI作品集封面/AI 创意广告-联想（联想特别鸣谢奖_官号转发）.jpg';
import tongyiCover from '../../AI作品集封面/AI 创意广告-通义万相先导片（官号首发）.jpg';
import chageeCover from '../../AI作品集封面/AI 创意广告-霸王茶姬（中国联通三等奖）.jpg';
import catsCover from '../../AI作品集封面/AI 创意短片-猫咪的一天（中国联通三等奖）.jpg';
import yueyangCover from '../../AI作品集封面/AI 文旅宣传-岳阳楼（优秀奖_超棒奖）.jpg';
import riverCityCover from '../../AI作品集封面/AI 概念短片-人河流城市（MJ 官方优秀作品）.jpg';
import lightCover from '../../AI作品集封面/AI 概念短片-光（通义光引-还不错奖｜通义生动-优秀奖）.jpg';
import './CometCard.css';

const ARCHIVES = [
  { id: '01', title: '屈臣氏 AI 创意广告', category: 'AI 创意广告', award: '优秀奖', cover: watsonsCover },
  { id: '02', title: '联想 AI 创意广告', category: 'AI 创意广告', award: '联想特别鸣谢奖', cover: lenovoCover },
  { id: '03', title: '通义万相先导片', category: 'AI 创意广告', award: '通义官号首发', cover: tongyiCover },
  { id: '04', title: '霸王茶姬 AI 创意广告', category: 'AI 创意广告', award: '中国联通三等奖', cover: chageeCover },
  { id: '05', title: '猫咪的一天', category: 'AI 创意短片', award: '中国联通三等奖', cover: catsCover },
  { id: '06', title: '岳阳楼 AI 文旅宣传', category: 'AI 文旅宣传', award: '超棒奖 · 优秀奖', cover: yueyangCover },
  { id: '07', title: '人河流城市', category: 'AI 概念短片', award: 'MJ 官方优秀作品', cover: riverCityCover },
  { id: '08', title: '光', category: 'AI 概念短片', award: '还不错奖 · 优秀奖', cover: lightCover },
];

export default function MagneticProjectArchive() {
  const archiveRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);

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
      <div ref={archiveRef} className="comet-archive" role="list" aria-label="AI 视频创作档案">
      {ARCHIVES.map(archive => (
        <CometCard key={archive.id} className="comet-archive__item">
          <button
            type="button"
            className="comet-archive__card"
            aria-label={`${archive.title}，${archive.award}`}
            style={{ '--comet-cover': `url(${archive.cover})` }}
          >
            <span className="comet-archive__glass" aria-hidden="true" />
            <span className="comet-archive__image" aria-hidden="true" />
            <span className="comet-archive__award">WORK / {archive.category}</span>
            <span className="comet-archive__copy">
              <span className="comet-archive__meta">{archive.id} / AWARD</span>
              <span className="comet-archive__details"><strong>{archive.award}</strong></span>
            </span>
          </button>
        </CometCard>
      ))}
      </div>
      {canScroll && <p className="comet-archive__scroll-hint" aria-hidden="true">左右滑动查看更多 <span>→</span></p>}
    </>
  );
}
