
import coverOverrides from './project-cover-overrides.json';
import videoMetadata from './project-video-metadata.json';
import autoProjects from './auto-projects.json';
import projectOrder from './project-order.json';
import projectVersionOrder from './project-version-order.json';
import projectTitleOverrides from './project-title-overrides.json';
import localVideoPaths from './local-video-paths.json';
import legacyVideoUrls from './legacy-imagekit-urls.json';
import legacyVideoVariants from './legacy-video-variants.json';
import legacyMainVersionLabels from './legacy-main-version-labels.json';
import archived from './archive-state.json';

const playerPosters = import.meta.glob('../../assets/images/player-posters/*/*.webp', { eager: true, query: '?url', import: 'default' });

const projectCoverAssets = import.meta.glob('../../assets/images/project-covers/*/*.webp', { eager: true, query: '?url', import: 'default' });

// Local Vite development always plays local originals: never charge ImageKit
// during manual testing. Production still uses the original ImageKit URLs.
const videoSource = (localPath, imageKitUrl = null, projectId = null) => {
  if (import.meta.env.DEV) {
    // Preserve the existing archive's misspelled folder without moving videos.
    const archivePath = (localVideoPaths[projectId] || localPath).replace(/^AI Short Films\//, 'AI Short Flims/');
    return `${import.meta.env.BASE_URL}assets/videos/works/${encodeURI(archivePath)}`;
  }
  return imageKitUrl || null;
};

// Original works retain one videoUrl; auto-created works may add distinct variants.
// Remote ImageKit URLs are configured per video, or null while awaiting upload.
// caseStudy is reserved for
// future verified project information; no detail-page UI is enabled yet.
export const PROJECT_CATEGORIES = [
  { id: 'commercial', label: { zh: 'AI 商业广告', en: 'AI Commercials' }, description: { zh: 'TVC、品牌与产品广告、文旅宣传片', en: 'TVC, brand and product advertising, and travel promotion films' } },
  { id: 'short-film', label: { zh: 'AI 创意短片', en: 'AI Short Films' }, description: { zh: '剧情、故事叙事、情绪短片与概念电影', en: 'Stories, emotional shorts and concept films' } },
  { id: 'social', label: { zh: 'AI 海外产品广告', en: 'AI Product & Social Ads' }, description: { zh: '面向海外市场的产品展示、场景体验与社媒创意广告', en: 'AI product demos, lifestyle ads and social media videos' } },
  { id: 'visual', label: { zh: 'AI 视觉实验', en: 'AI Visual Experiments' }, description: { zh: 'AI 特效、视觉风格测试、技术探索与实验影像', en: 'AI effects, visual studies, technical exploration and experimental imagery' } },
];

const BASE_PROJECTS = [
  { id: '01', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-屈臣氏（优秀奖）.mp4', legacyVideoUrls['01'], '01'), caseStudy: null, platform: { zh: '01 / 小红书', en: '01 / REDnote' }, title: { zh: "屈臣氏品牌广告", en: "Watsons Brand Commercial" }, award: { zh: '优秀奖', en: 'Excellence Award' }, cover: null, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/688d99d1000000002203a643?source=webshare&xhsshare=pc_web&xsec_token=AB2HumoFo2_bj_DqZ4oAH4r0-H5GGEtHFUn9RIYEcCOv8=&xsec_source=pc_share' },
  { id: '02', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-联想（联想特别鸣谢奖|官号转发）.mp4', legacyVideoUrls['02'], '02'), caseStudy: null, platform: { zh: '02 / 小红书', en: '02 / REDnote' }, title: { zh: "联想品牌广告", en: "Lenovo Brand Commercial" }, award: { zh: '联想特别鸣谢奖', en: 'Special Recognition from Lenovo' }, cover: null, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/684da8f8000000000c03a0e8?source=webshare&xhsshare=pc_web&xsec_token=AB4tZju6OcifF-7IglVCRs3XbtKen4Xwp6o5QSWw0Ltnk=&xsec_source=pc_share' },
  { id: '03', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-通义wan2.2官方宣传片.mp4', legacyVideoUrls['03'], '03'), caseStudy: null, platform: { zh: '03 / 抖音', en: '03 / Douyin' }, title: { zh: "通义万相 2.2 宣传片", en: "Wan2.2 Promotional Film" }, award: { zh: '通义官号首发', en: "Featured on Tongyi's Official Channel" }, cover: null, sourceUrl: 'https://www.douyin.com/video/7533565207131131196' },
  { id: '04', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 品牌广告-霸王茶姬（中国联通三等奖）.mp4', legacyVideoUrls['04'], '04'), caseStudy: null, platform: { zh: '04 / 小红书', en: '04 / REDnote' }, title: { zh: "霸王茶姬品牌广告", en: "CHAGEE Brand Commercial" }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, cover: null, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/6834a782000000000c03a3c1?source=webshare&xhsshare=pc_web&xsec_token=ABNgGVOpSb6RP8pGc_DcVAxOfnmMhtaK2TiKQoaJkZKIw=&xsec_source=pc_share' },
  { id: '05', category: 'short-film', featured: true, videoUrl: videoSource('AI Short Films/AI 创意短片-猫咪的一天（中国联通三等奖）.mp4', legacyVideoUrls['05'], '05'), caseStudy: null, platform: { zh: '05 / 小红书', en: '05 / REDnote' }, title: { zh: "猫咪的一天", en: "A Day in a Cat's Life" }, award: { zh: '中国联通三等奖', en: 'China Unicom 3rd Prize' }, cover: null, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/6858bb32000000002400ba58?source=webshare&xhsshare=pc_web&xsec_token=AB264App4J-oDzd1MVj8Vrc327aQZBjWlclryVOGFc1X8=&xsec_source=pc_share' },
  { id: '06', category: 'commercial', featured: true, videoUrl: videoSource('AI Commercials/AI 文旅宣传-岳阳楼（优秀奖|超棒奖）.mp4', legacyVideoUrls['06'], '06'), caseStudy: null, platform: { zh: '06 / 小红书', en: '06 / REDnote' }, title: { zh: "岳阳楼文旅宣传片", en: "Yueyang Tower Tourism Film" }, award: { zh: '超棒奖', en: 'Awesome Award' }, cover: null, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/68165055000000000e00525b?source=webshare&xhsshare=pc_web&xsec_token=ABDq1xQzCks5P83-ccrIgTlh_Pj6F4otf3gkmI-Y0Ugh0=&xsec_source=pc_share' },
  { id: '07', category: 'short-film', featured: true, videoUrl: videoSource('AI Short Films/AI 概念短片-人河流城市（Midjourney官方优秀作品）.mp4', legacyVideoUrls['07'], '07'), caseStudy: null, platform: { zh: '07 / 小红书', en: '07 / REDnote' }, title: { zh: "人、河流与城市", en: "People, Rivers and Cities" }, award: { zh: 'MJ 官方优秀作品', en: 'Featured by Midjourney' }, cover: null, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/68b8051d000000001d00936f?source=webshare&xhsshare=pc_web&xsec_token=AB_COh4fY4yQq-A1yx_pOf7OadIS_o61EUSTaIJWvmwOU=&xsec_source=pc_share' },
  { id: '08', category: 'short-film', featured: true, videoUrl: videoSource('AI Short Films/AI 概念短片-光（通义万相 光引-还不错奖｜通义万相 生动-优秀奖）.mp4', legacyVideoUrls['08'], '08'), caseStudy: null, platform: { zh: '08 / 小红书', en: '08 / REDnote' }, title: { zh: "光", en: "Light" }, award: { zh: '优秀奖', en: 'Excellence Award' }, cover: null, sourceUrl: 'https://www.xiaohongshu.com/discovery/item/688f595c0000000023031b1e?source=webshare&xhsshare=pc_web&xsec_token=AB1dIKBSOCR_91FMS218sLjy66ZJrUFPjhjkxX0Dejau0=&xsec_source=pc_share' },
  { id: '09', category: 'commercial', featured: false, videoUrl: videoSource('AI Commercials/海外无线耳机 AI 场景广告.mp4', legacyVideoUrls['09'], '09'), caseStudy: null, title: { zh: "无线耳机场景广告", en: "Wireless Earbuds Lifestyle Ad" }, award: { zh: '', en: '' }, cover: null, sourceUrl: null },
  { id: '10', category: 'social', featured: false, videoUrl: videoSource('AI Overseas Product Ads/Wireless Earbuds Product Showcase.mp4', legacyVideoUrls['10'], '10'), caseStudy: null, title: { zh: "无线耳机产品展示", en: "Wireless Earbuds Product Showcase" }, award: { zh: '', en: '' }, cover: null, sourceUrl: null },
  { id: '11', category: 'social', featured: false, videoUrl: videoSource('AI Overseas Product Ads/海外无线耳机 AI 社媒创意广告.mp4', legacyVideoUrls['11'], '11'), caseStudy: null, title: { zh: "无线耳机搞笑广告", en: "Wireless Earbuds Comedy Ad" }, award: { zh: '', en: '' }, cover: null, sourceUrl: null },
  { id: '13', category: 'social', featured: false, videoUrl: videoSource('AI Overseas Product Ads/海外宠物红光护理仪 AI 产品广告.mp4', legacyVideoUrls['13'], '13'), caseStudy: null, title: { zh: "宠物红光护理仪广告", en: "Pet Red Light Therapy Ad" }, award: { zh: '', en: '' }, cover: null, sourceUrl: null },
  { id: '14', category: 'visual', featured: false, videoUrl: videoSource('AI Visual Experiments/AI 创意短片-中式国风巨物美学.mp4', legacyVideoUrls['14'], '14'), caseStudy: null, title: { zh: "国风巨物美学", en: "Monumental Chinese Visuals" }, award: { zh: '', en: '' }, cover: null, sourceUrl: null },
  { id: '15', category: 'visual', featured: false, videoUrl: videoSource('AI Visual Experiments/AI 创意短片-最难的告别.mp4', legacyVideoUrls['15'], '15'), caseStudy: null, title: { zh: "最难的告别", en: "The Hardest Goodbye" }, award: { zh: '', en: '' }, cover: null, sourceUrl: null },
  // Generated by Cover Studio. They join the library and can be selected as featured later.
  ...autoProjects.map(({ localVideoPath, coverFile, variants = [], ...project }) => ({
    ...project,
    videoUrl: videoSource(localVideoPath, project.videoUrl || null),
    cover: projectCoverAssets[`../../assets/images/project-covers/${coverFile}`] || null,
    variants: variants.map(({ localVideoPath: variantPath, posterFile, ...variant }) => ({
      ...variant, videoUrl: videoSource(variantPath, variant.videoUrl || null),
      playerPoster: playerPosters[`../../assets/images/player-posters/${posterFile}`] || null,
    })),
  })),
].map(project => {
  const cover = projectCoverAssets[`../../assets/images/project-covers/${coverOverrides[project.id]}`];
  const media = videoMetadata[project.id] || {};
  const variants=project.variants || (legacyVideoVariants[project.id]||[]).map(({localVideoPath,posterFile,...variant})=>({
    ...variant,
    videoUrl:videoSource(localVideoPath,variant.videoUrl||null),
    playerPoster:playerPosters[`../../assets/images/player-posters/${posterFile}`]||null,
  }));
  return { ...project, variants: variants.filter(v=>!archived.versions?.[project.id]?.[v.id]),
    mainVersionArchived: Boolean(archived.versions?.[project.id]?.main),
    versionOrder: projectVersionOrder[project.id] || [],
    ...(project.mainVersionLabel || legacyMainVersionLabels[project.id]
      ? {mainVersionLabel:project.mainVersionLabel || legacyMainVersionLabels[project.id]} : {}),
    ...(projectTitleOverrides[project.id] ? {title:projectTitleOverrides[project.id]} : {}), ...(cover ? { cover } : {}),
    videoWidth: media.videoWidth, videoHeight: media.videoHeight,
    playerPoster: playerPosters[`../../assets/images/player-posters/${media.playerPoster}`] || null,
  };
}).filter(project=>!archived.works?.[project.id]);

// Two independent, local-workbench-managed display orders. Never change stable
// project IDs, image/video references, metadata or a project's category.
// New projects absent from the stored list automatically append to All Work.
const displayOrder = (projects, ids) => {
  const positions = new Map(ids.map((id, i) => [id, i]));
  return [...projects].sort((a, b) => {
    const ai = positions.get(a.id) ?? Infinity, bi = positions.get(b.id) ?? Infinity;
    return ai - bi;
  });
};
// Selection is entirely controlled by project-order.json. Older data entries
// still carry their original featured flag for historical context, but the
// effective status follows the user's eight curated IDs.
export const FEATURED_PROJECT_IDS = projectOrder.featured;
const selectedFeatured = new Set(FEATURED_PROJECT_IDS);
if (selectedFeatured.size !== 8 || FEATURED_PROJECT_IDS.some(id => !BASE_PROJECTS.some(project => project.id === id))) {
  throw new Error('Homepage Featured must contain exactly eight existing, unique projects.');
}
// Homepage Featured and All Work are two independent display orders.
export const PROJECTS = displayOrder(BASE_PROJECTS, projectOrder.all).map(project => ({
  ...project,
  featured: selectedFeatured.has(project.id),
}));
export const FEATURED_PROJECTS = FEATURED_PROJECT_IDS.map(id => {
  const project = PROJECTS.find(item => item.id === id);
  if (!project) throw new Error(`Missing featured project: ${id}`);
  return project;
});
