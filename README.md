# Ai路人｜AI 视频创意与影像效果作品集

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="Ai路人的作品集：为品牌创作 AI 广告、产品影像与创意短片，呈现商业广告、创意短片和影像效果方向" />
</p>

为品牌创作 AI 广告、产品影像与创意短片，从创意构思到最终成片。网站支持中文与英文浏览，可从首页查看精选作品，也可进入完整作品库。

<p align="center">
  <a href="https://ailuren.netlify.app/">在线作品集</a> ·
  <a href="https://ailuren.netlify.app/works.html">全部作品</a> ·
  <a href="#本地运行">本地运行</a> ·
  <a href="./docs/交接说明.md">维护说明</a>
</p>

## 代表作品

首页精选 8 件创作，完整作品库共 15 件，涵盖 AI 商业广告（7）、创意短片（3）、海外产品广告（3）、视觉实验（2）。所有作品以统一 3:4 封面展示，点击后在站内影院播放器观看原始比例视频。以下为首页精选中的项目封面。

<p align="center">
  <img src="./assets/images/project-covers/AI 创意广告-通义万相先导片（官号首发）.webp" width="49%" alt="通义万相 AI 品牌广告封面" />
  <img src="./assets/images/project-covers/AI 概念短片-光（通义光引-还不错奖｜通义生动-优秀奖）.webp" width="49%" alt="通义万相 AI 创意短片《光》封面" />
</p>
<p align="center"><sub>通义万相 AI 品牌广告 · 通义万相 AI 创意短片</sub></p>

<p align="center">
  <img src="./assets/images/project-covers/AI 创意短片-猫咪的一天（中国联通三等奖）.webp" width="49%" alt="宠物 AI 创意短片封面" />
  <img src="./assets/images/project-covers/AI 概念短片-人河流城市（MJ 官方优秀作品）.webp" width="49%" alt="悠船 AI 创意短片封面" />
</p>
<p align="center"><sub>宠物 AI 创意短片 · 悠船 AI 创意短片</sub></p>

## 网站内容

- **精选创作档案**：首页展示 8 件精选作品，点击封面进入影院式播放器。
- **全部作品库**：独立 `works.html` 页面，共 15 件作品，可按商业广告、创意短片、海外产品广告、视觉实验浏览。
- **专业实力**：集中展示 AI 创作赛事获奖、平台创作者项目和多平台内容成果。
- **AI 实验室**：三个真实工具项目——[AI 新闻追踪](https://github.com/Ai-luren/Ainews-to-Feishu)、[AI 文章配图](https://github.com/Ai-luren/Ailuren-illustrations)、[图片对比工具](https://github.com/Ai-luren/Image-comparison)。
- **关于与合作**：介绍 AI 影像创作方向，并提供邮箱、微信和社交平台入口。

### 海外产品广告（作品 09–13）

作品 09–10 属于「AI 商业广告」，作品 11–13 属于「AI 海外产品广告」。三条无线耳机视频虽为同款产品，但分别以生活场景、产品展示和社媒创意呈现；另有车载坐垫体验及宠物红光护理仪广告。作品名称在中文和英文模式下均分别命名，不再用编号或泛称区别。

| 编号 | 中文作品名 | English |
| --- | --- | --- |
| 09 | 海外无线耳机 AI 场景广告 | Overseas Wireless Earbuds AI Lifestyle Ad |
| 10 | 海外无线耳机 AI 产品展示广告 | Overseas Wireless Earbuds AI Product Showcase |
| 11 | 海外无线耳机 AI 社媒创意广告 | Overseas Wireless Earbuds AI Social Creative Ad |
| 12 | 海外车载坐垫 AI 产品体验广告 | Overseas Car Seat Cushion AI Product Demo |
| 13 | 海外宠物红光护理仪 AI 产品广告 | Overseas Pet Red-Light Care Device AI Ad |

## 2026-10-21 体验与稳定性更新

- **首屏影像**：手机和桌面均优先展示飞船视频的静态首帧，视频立即预热；WebGL 第一帧准备好后再平滑接管，避免首屏黑场。GPU 上下文丢失时恢复原生视频兜底。
- **导航**：在 761px 及以上统一显示四项文字导航；760px 及以下使用折叠菜单。横竖屏切换越过断点会立即关闭菜单、恢复滚动和焦点；手机菜单具备焦点约束。
- **查看器动效**：作品播放器、获奖荣誉与自媒体账号资料使用统一的轻量进入和退出过渡；支持快速关闭、焦点恢复及减少动态效果设置。
- **获奖图片**：针对「海螺AI动物跳水」素材右侧原生亮线进行局部裁切，不影响其他奖项图。
- **媒体安全与维护**：本地开发与自动化检查避免请求 ImageKit；删除停用组件和重复素材，冻结已验收的 Hero 参数；海外产品的本地原片、默认封面、自定义封面和播放器海报名同步完成。

## 本地运行

需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm ci
npm run dev
```

在项目仓库目录运行以上命令。
开发服务器固定 `http://127.0.0.1:5174/`；`npm run preview` 的生产预览固定 `http://127.0.0.1:5181/`。请通过 Vite 服务访问页面，不要直接用 `file://` 打开 `index.html`。

> **媒体注意**：`npm run dev` 使用本地 `assets/videos/works/` 的 15 部原片，文件由 `.gitignore` 排除，**不随 Git 克隆提供**；在新电脑上开发播放前需要自行放入对应原片。生产构建及 `npm run preview` 使用 ImageKit 正式视频 URL，主动点击播放会产生真实 CDN 流量。本地改名不需要重新上传生产视频。

## 技术与验证

项目使用 Vite、React、GSAP 和 OGL/WebGL，包含首页和独立作品库两个入口。首页章节与滚动视频背景在 HTML 中；React 负责作品、影响力、实验室和播放器交互。本地开发使用 Git 忽略的 `assets/videos/works/` 原片，不访问 ImageKit；生产环境保留 15 条 ImageKit `tr:orig-true` 视频地址，作品视频仅在用户主动播放后加载。

```bash
npm run build
npm run check:i18n
npm run check:responsive
npm run check:media-safety
npm run check:hero-first-frame
npm run check:overseas-names
npm run check:nav-modal-breakpoints
npm run check:modal-motion
npm run check:award-edge
git diff --check
```

作品库数据另有专项检查脚本：`scripts/check-project-library.mjs`；本地封面工具端到端检查是 `node scripts/check-cover-studio.mjs`（需系统 FFmpeg），日常启动工具使用 `npm run covers`。所有浏览器自动化检查均使用媒体保护拦截，不触发 ImageKit 视频下载。

## 目录与维护入口

```text
index.html
works.html
src/data/projects.js
src/components/
src/i18n/dictionary.js
assets/images/project-covers/
assets/images/player-posters/
assets/videos/hero/
assets/videos/works/           # Git 忽略，需本地原片
docs/
tools/cover-studio/
```

- 页面章节、Hero 与滚动叙事：`index.html`
- 首页精选和作品库共用数据：`src/data/projects.js`
- 作品、播放器、影响力和实验室：`src/components/`
- 中英文文案：`src/i18n/dictionary.js`
- 作品数据和播放器媒体维护：[`作品库维护`](./docs/作品库维护.md)、[`播放器媒体维护`](./docs/播放器媒体维护.md)

开始维护前，先阅读 [`AGENTS.md`](./AGENTS.md)、[`docs/设计规范.md`](./docs/设计规范.md) 和 [`docs/交接说明.md`](./docs/交接说明.md)。

## 许可证

本项目按 [MIT License](./LICENSE) 发布。

Copyright (c) 2026 Ai路人
