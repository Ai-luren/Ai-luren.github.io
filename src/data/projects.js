import watsonsCover from '../../assets/images/project-covers/AI 创意广告-屈臣氏（优秀奖）.webp';
import lenovoCover from '../../assets/images/project-covers/AI 创意广告-联想（联想特别鸣谢奖_官号转发）.webp';
import tongyiCover from '../../assets/images/project-covers/AI 创意广告-通义万相先导片（官号首发）.webp';
import chageeCover from '../../assets/images/project-covers/AI 创意广告-霸王茶姬（中国联通三等奖）.webp';
import catsCover from '../../assets/images/project-covers/AI 创意短片-猫咪的一天（中国联通三等奖）.webp';
import yueyangCover from '../../assets/images/project-covers/AI 文旅宣传-岳阳楼（优秀奖_超棒奖）.webp';
import riverCityCover from '../../assets/images/project-covers/AI 概念短片-人河流城市（MJ 官方优秀作品）.webp';
import lightCover from '../../assets/images/project-covers/AI 概念短片-光（通义光引-还不错奖｜通义生动-优秀奖）.webp';

import earbudsCover from '../../assets/images/project-covers/library/earbuds.webp';
import earbuds2Cover from '../../assets/images/project-covers/library/earbuds-2.webp';
import ugcEarbudsCover from '../../assets/images/project-covers/library/ugc-earbuds.webp';
import cushionCover from '../../assets/images/project-covers/library/ugc-cushion.webp';
import petLightCover from '../../assets/images/project-covers/library/ugc-pet-light.webp';
import giantsCover from '../../assets/images/project-covers/library/chinese-giants.webp';
import farewellCover from '../../assets/images/project-covers/library/farewell.webp';
import coverOverrides from './project-cover-overrides.json';
import videoMetadata from './project-video-metadata.json';

const playerPosters = import.meta.glob('../../assets/images/player-posters/*.webp', { eager: true, query: '?url', import: 'default' });

const customCovers = import.meta.glob('../../assets/images/project-covers/custom/*.webp', { eager: true, query: '?url', import: 'default' });

// Public ImageKit URLs are the playback source in development and production.
// Local originals remain available as a development fallback for future works.
const videoSource = (localPath, imageKitUrl = null) => imageKitUrl || (import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}assets/videos/works/${encodeURI(localPath)}`
  : null);

// Only real works belong here. Add one videoUrl per work (ImageKit HTTPS URL),
// or leave null to display the pending-upload state. caseStudy is reserved for
// future verified project information; no detail-page UI is enabled yet.
export const PROJECT_CATEGORIES = [
  { id: 'all', label: { zh: '全部', en: 'All' } },
  { id: 'commercial', label: { zh: 'AI 商业广告', en: 'AI Commercials' }, description: { zh: 'TVC、品牌与产品广告、文旅宣传片。', en: 'TVC, brand and product advertising, and travel promotion films.' } },
  { id: 'short-film', label: { zh: 'AI 创意短片', en: 'AI Short Films' }, description: { zh: '剧情、故事叙事、情绪短片与概念电影。', en: 'Stories, emotional shorts and concept films.' } },
  { id: 'social', label: { zh: 'AI 社媒与 UGC 广告', en: 'AI Social & UGC' }, description: { zh: 'UGC、TikTok、社媒营销与信息流广告。', en: 'UGC, TikTok, social content and performance advertising.' } },
  { id: 'visual', label: { zh: 'AI 视觉实验', en: 'AI Visual Experiments' }, description: { zh: 'AI 特效、视觉风格测试、技术探索与实验影像。', en: 'AI effects, visual studies, technical exploration and experimental imagery.' } },
];

export const PROJECTS = [
  { id: '01', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-屈臣氏（优秀奖）.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/watsons-commercial.mp4'), caseStudy: null, platform: { zh: '01 / 小红书', en: '01 / RED' }, title: { zh: '屈臣氏 AI 品牌广告', en: 'Watsons AI Brand Ad' }, award: { zh: '优秀奖', en: 'Excellence Award' }, cover: watsonsCover, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/688d99d1000000002203a643?source=webshare&xhsshare=pc_web&xsec_token=AB2HumoFo2_bj_DqZ4oAH4r0-H5GGEtHFUn9RIYEcCOv8=&xsec_source=pc_share' },
  { id: '02', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-联想（联想特别鸣谢奖|官号转发）.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/lenovo-commercial.mp4'), caseStudy: null, platform: { zh: '02 / 小红书', en: '02 / RED' }, title: { zh: '联想 AI 品牌广告', en: 'Lenovo AI Brand Ad' }, award: { zh: '联想特别鸣谢奖', en: 'Lenovo Special Thanks' }, cover: lenovoCover, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/684da8f8000000000c03a0e8?source=webshare&xhsshare=pc_web&xsec_token=AB4tZju6OcifF-7IglVCRs3XbtKen4Xwp6o5QSWw0Ltnk=&xsec_source=pc_share' },
  { id: '03', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-通义wan2.2官方宣传片.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/wan-2-2-showcase.mp4'), caseStudy: null, platform: { zh: '03 / 抖音', en: '03 / Douyin' }, title: { zh: '通义万相 AI 品牌广告', en: 'Wan AI Brand Ad' }, award: { zh: '通义官号首发', en: 'Featured by Tongyi Official' }, cover: tongyiCover, sourceUrl: 'https://www.douyin.com/video/7533565207131131196' },
  { id: '04', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-霸王茶姬（中国联通三等奖）.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/chagee-commercial.mp4'), caseStudy: null, platform: { zh: '04 / 小红书', en: '04 / RED' }, title: { zh: '霸王茶姬 AI 品牌广告', en: 'Chagee AI Brand Ad' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, cover: chageeCover, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/6834a782000000000c03a3c1?source=webshare&xhsshare=pc_web&xsec_token=ABNgGVOpSb6RP8pGc_DcVAxOfnmMhtaK2TiKQoaJkZKIw=&xsec_source=pc_share' },
  { id: '05', category: 'short-film', featured: true, videoUrl: videoSource('AI Short Flims/AI 创意短片-猫咪的一天（中国联通三等奖）.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/a-day-with-cat.mp4'), caseStudy: null, platform: { zh: '05 / 小红书', en: '05 / RED' }, title: { zh: '宠物 AI 创意短片', en: 'Pet AI Short Film' }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, cover: catsCover, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/6858bb32000000002400ba58?source=webshare&xhsshare=pc_web&xsec_token=AB264App4J-oDzd1MVj8Vrc327aQZBjWlclryVOGFc1X8=&xsec_source=pc_share' },
  { id: '06', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 文旅宣传-岳阳楼（优秀奖|超棒奖）.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/yueyang-tower.mp4'), caseStudy: null, platform: { zh: '06 / 小红书', en: '06 / RED' }, title: { zh: '湖南 AI 文旅宣传', en: 'Hunan AI Travel Film' }, award: { zh: '超棒奖', en: 'Awesome Award' }, cover: yueyangCover, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/68165055000000000e00525b?source=webshare&xhsshare=pc_web&xsec_token=ABDq1xQzCks5P83-ccrIgTlh_Pj6F4otf3gkmI-Y0Ugh0=&xsec_source=pc_share' },
  { id: '07', category: 'short-film', featured: true, videoUrl: videoSource('AI Short Flims/AI 概念短片-人河流城市（Midjourney官方优秀作品）.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/people-river-city.mp4'), caseStudy: null, platform: { zh: '07 / 小红书', en: '07 / RED' }, title: { zh: '悠船 AI 创意短片', en: 'Midjourney AI Short Film' }, award: { zh: 'MJ 官方优秀作品', en: 'Midjourney Official Featured' }, cover: riverCityCover, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/68b8051d000000001d00936f?source=webshare&xhsshare=pc_web&xsec_token=AB_COh4fY4yQq-A1yx_pOf7OadIS_o61EUSTaIJWvmwOU=&xsec_source=pc_share' },
  { id: '08', category: 'short-film', featured: true, videoUrl: videoSource('AI Short Flims/AI 概念短片-光（通义万相 光引-还不错奖｜通义万相 生动-优秀奖）.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/light.mp4'), caseStudy: null, platform: { zh: '08 / 小红书', en: '08 / RED' }, title: { zh: '通义万相 AI 创意短片', en: 'WAN AI Short Film' }, award: { zh: '优秀奖', en: 'Excellence Award' }, cover: lightCover, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/688f595c0000000023031b1e?source=webshare&xhsshare=pc_web&xsec_token=AB1dIKBSOCR_91FMS218sLjy66ZJrUFPjhjkxX0Dejau0=&xsec_source=pc_share' },
  { id: '09', category: 'commercial', featured: false, videoUrl: videoSource('AI Commercials/AI 品牌广告-无线耳机 TVC广告.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/wireless-earbuds-tvc.mp4'), caseStudy: null, title: { zh: '无线耳机 AI 品牌广告', en: 'Wireless Earbuds AI Ad' }, award: { zh: '', en: '' }, cover: earbudsCover, sourceUrl: null },
  { id: '10', category: 'commercial', featured: false, videoUrl: videoSource('AI Commercials/AI 品牌广告-无线耳机 产品展示.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/wireless-earbuds-showcase.mp4'), caseStudy: null, title: { zh: '无线耳机 AI 品牌广告 2', en: 'Wireless Earbuds AI Ad 2' }, award: { zh: '', en: '' }, cover: earbuds2Cover, sourceUrl: null },
  { id: '11', category: 'social', featured: false, videoUrl: videoSource('AI Social & UGC/AI UGC-海外耳机广告.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/ugc-earbuds-ad.mp4'), caseStudy: null, title: { zh: '耳机 UGC 广告', en: 'Earbuds UGC Ad' }, award: { zh: '', en: '' }, cover: ugcEarbudsCover, sourceUrl: null },
  { id: '12', category: 'social', featured: false, videoUrl: videoSource('AI Social & UGC/AI UGC-海外坐垫.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/seat-cushion-ad.mp4'), caseStudy: null, title: { zh: '海外坐垫 UGC 广告', en: 'Cushion UGC Ad' }, award: { zh: '', en: '' }, cover: cushionCover, sourceUrl: null },
  { id: '13', category: 'social', featured: false, videoUrl: videoSource('AI Social & UGC/AI UGC-海外宠物的红光疗法设备.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/pet-red-light-therapy.mp4'), caseStudy: null, title: { zh: '宠物红光疗法设备 UGC 广告', en: 'Pet Light Therapy UGC Ad' }, award: { zh: '', en: '' }, cover: petLightCover, sourceUrl: null },
  { id: '14', category: 'visual', featured: false, videoUrl: videoSource('AI Visual Experiments/AI 创意短片-中式国风巨物美学.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/chinese-giant-aesthetics.mp4'), caseStudy: null, title: { zh: '中式国风巨物美学', en: 'Chinese Giant Aesthetics' }, award: { zh: '', en: '' }, cover: giantsCover, sourceUrl: null },
  { id: '15', category: 'visual', featured: false, videoUrl: videoSource('AI Visual Experiments/AI 创意短片-最难的告别.mp4', 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/hardest-goodbye.mp4'), caseStudy: null, title: { zh: '最难的告别', en: 'The Hardest Goodbye' }, award: { zh: '', en: '' }, cover: farewellCover, sourceUrl: null },
].map(project => {
  const cover = customCovers[`../../assets/images/project-covers/custom/${coverOverrides[project.id]}`];
  const media = videoMetadata[project.id] || {};
  return { ...project, ...(cover ? { cover } : {}),
    videoWidth: media.videoWidth, videoHeight: media.videoHeight,
    playerPoster: playerPosters[`../../assets/images/player-posters/${media.playerPoster}`] || null,
  };
});

// The home selection stays at eight; new works can enter the library without
// changing the home layout or its two-page mobile gesture behavior.
export const FEATURED_PROJECTS = PROJECTS.filter(project => project.featured).slice(0, 8);
