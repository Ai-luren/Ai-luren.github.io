# Ai路人｜AI 视频创意与视觉设计作品集

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="Ai路人的 AI 视频创意与视觉设计作品集：从动态设计、产品品牌到 AI 创意效果与工作流" />
</p>

<p align="center">
  Ai路人的 AI 影像作品集：通过首页精选、独立作品库和影院式播放器展示商业广告、创意短片、社媒作品与视觉实验。
</p>

<p align="center">
  <a href="https://ailuren.netlify.app/">在线浏览</a> ·
  <a href="https://ailuren.pages.dev/">国内访问</a> ·
  <a href="#本地运行">本地运行</a> ·
  <a href="./docs/交接说明.md">交接说明</a>
</p>

## 先看作品

这些是首页精选创作档案中的真实封面。首页保留 8 件精选作品；完整作品库在独立的 `works.html` 页面中维护，当前共用 15 件作品数据和分类。点击封面可在站内影院播放器查看视频。

<p align="center">
  <img src="./assets/images/project-covers/AI 创意广告-通义万相先导片（官号首发）.webp" width="49%" alt="通义万相 AI 品牌广告项目封面" />
  <img src="./assets/images/project-covers/AI 概念短片-光（通义光引-还不错奖｜通义生动-优秀奖）.webp" width="49%" alt="光 AI 概念短片项目封面" />
</p>
<p align="center"><sub>通义万相先导片 · 光 AI 概念短片</sub></p>

<p align="center">
  <img src="./assets/images/project-covers/AI 创意短片-猫咪的一天（中国联通三等奖）.webp" width="49%" alt="猫咪的一天 AI 创意短片封面" />
  <img src="./assets/images/project-covers/AI 概念短片-人河流城市（MJ 官方优秀作品）.webp" width="49%" alt="人河流城市 AI 概念短片封面" />
</p>
<p align="center"><sub>猫咪的一天 · 人河流城市</sub></p>

## 这是一个什么项目

这是一个以滚动视频为叙事主线的个人作品集，不是传统的项目管理后台。页面把创作路径拆成几个可以直接浏览的模块：

- **精选创作档案**：8 件首页精选作品，提供横向浏览和站内视频弹窗。
- **全部作品库**：独立 `works.html` 页面，共享作品数据，按商业广告、创意短片、社媒与 UGC、视觉实验分类。
- **关于我**：简要介绍 AI 影像创作方向及在快手、小米的创意制作与产品实践经验。
- **AI 影响力**：获奖作品、AI 视频平台合作创作者身份，以及抖音、小红书等内容发布证据。
- **AI 实验室**：持续探索中的 Vibe Coding、AI 工具和可复用工作流。

## 交互体验

- 桌面端使用轻量 hover、焦点和章节过渡，让卡片有反馈但不抢走作品本身的注意力。
- 手机端支持精选作品和获奖作品左右滑动，同时保留原生纵向滚动；关于我保持简洁阅读布局。
- 作品播放器打开时只显示海报；用户主动播放后才加载视频。15 件作品使用 ImageKit 原始 MP4 地址，按视频真实宽高比显示。
- 视频封面可在本地 `npm run covers` 工作台中选择和导出；本地工具与工作文件不进入正式网站构建。
- 移动导航保持固定位置，菜单展开时使用稳定的 `=` / `×` 过渡和逐项出现的导航内容。
- 中英文页面都使用系统字体栈，并针对手机与桌面视口做布局回归。

## 技术结构

页面使用两个 Vite HTML 入口，React 承载需要组件化的交互模块：

```text
index.html
  ├─ 首页章节、Hero 背景视频、全局样式、滚动逻辑
  └─ React 19
       ├─ 首页精选创作档案 + 影院播放器
       ├─ AI 影响力证据
       ├─ AI 实验室
       └─ GSAP / WebGL 视觉交互
works.html
  └─ WorksLibrary（复用 src/data/projects.js、导航与播放器）
tools/cover-studio/
  └─ 本地封面维护工具，不属于 Vite 页面入口
```

这个混合架构是有意保留的：静态内容和媒体路径容易维护，React 负责作品档案、影响力模块、实验卡片和页脚 Dock 等交互组件；GSAP 与 ScrollTrigger 通过 `vendor/` 和运行时降级逻辑加载。

## 在线地址

- [GitHub Pages](https://ai-luren.github.io/)：备用地址，中国大陆网络可能无法直连。
- [Cloudflare Pages](https://ailuren.pages.dev/)：国内访问优先地址。
- [Netlify](https://ailuren.netlify.app/)：正式主域名，canonical、Open Graph 和结构化数据以此为准。
- [Vercel](https://ailuren.vercel.app/)：备用生产地址，中国大陆网络可能无法直连。

站点构建命令为 `npm run build`，产物位于 `dist/`。仓库内 GitHub Pages 工作流只在 `main` 分支触发；`netlify.toml` 配置 `npm run build` 和 `dist`。Cloudflare Pages、Vercel 等平台的连接与分支设置由各自平台后台管理，不能仅凭本仓库文件确认。

## 本地运行

需要 Node.js `^20.19.0` 或 `>=22.12.0`（Vite 运行时要求）。

```bash
git clone https://github.com/Ai-luren/Ai-luren.github.io.git
cd Ai-luren.github.io
npm ci
npm run dev
```

然后打开 <http://127.0.0.1:5174/>。不要双击 `index.html` 或使用 `file://` 打开，因为视频、相对路径和 React 模块需要由 Vite 提供服务。

### 构建与检查

```bash
npm run build
npm run check:i18n
node scripts/check-project-library.mjs
git diff --check
```

`check:i18n` 会扫描中英文在手机与桌面视口下的溢出、截断、导航适配和关键模块布局。

## 目录速览

```text
.
├── assets/                 页面媒体、图标与作品封面
│   └── videos/hero/        必需的桌面与移动 Hero 视频
├── docs/                   设计、维护与交接说明
├── src/components/         首页、作品库、影院、影响力和实验室组件
├── src/data/projects.js    首页与全部作品库共享数据
├── tools/cover-studio/     仅本机运行的封面工具
├── works.html              全部作品库入口
├── src/i18n/               中英文文案与语言切换
├── vendor/                 GSAP 与 ScrollTrigger 静态运行时
├── index.html              首页入口、章节、全局样式和媒体叙事
├── package.json            依赖与脚本
└── vite.config.js          Vite 构建配置
```

常见修改入口：

- 页面章节、首屏和页脚：`index.html`
- 首页及全部作品数据：`src/data/projects.js`
- 精选创作档案：`src/components/MagneticProjectArchive.jsx`
- 全部作品页：`works.html`、`src/components/WorksLibrary.jsx`
- 影院播放器：`src/components/CinemaPlayer.jsx`
- 获奖、平台和社交证据：`src/components/ImpactEvidence.jsx`
- AI 实验室卡片：`src/components/ExperimentFlip.jsx`
- 中英文文案：`src/i18n/dictionary.js`
- 字体、颜色、间距和动效：`src/styles/apple-system.css`
- 本地封面工作流：[`docs/本地封面工作流.md`](./docs/本地封面工作流.md)
- 作品库数据维护：[`docs/作品库维护.md`](./docs/作品库维护.md)
- 播放器媒体维护：[`docs/播放器媒体维护.md`](./docs/播放器媒体维护.md)

开始维护前，请先阅读 [`AGENTS.md`](./AGENTS.md)、[`docs/设计规范.md`](./docs/设计规范.md) 和 [`docs/交接说明.md`](./docs/交接说明.md)。

## 部署约定

```text
修改 → npm run build → npm run check:i18n → git diff --check
     → Pull Request → 检查预览 → 合并 main → 自动部署
```

`main` 是 GitHub Pages 工作流的部署分支；审查改动先推送独立分支并通过 Pull Request 检查。GitHub Pages 工作流只响应 `main` 推送或手动触发。Netlify 的构建/发布目录写在 `netlify.toml`；是否生成分支预览取决于站点后台的 Git 集成设置。

本地作品 MP4 位于 `assets/videos/works/`，CDN 上传副本位于 `local-media CDN/`；二者均由 `.gitignore` 排除，也不进入 `dist/`。Hero 视频位于 `assets/videos/hero/`，是网站必要资源，应保留并随站点构建。

## 许可证与联系

本项目以 [MIT License](./LICENSE) 发布。

完整作品、联系方式和社交入口会随页面内容更新，优先从[在线作品集](https://ailuren.netlify.app/)查看最新版本。

Copyright (c) 2026 Ai路人
