<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="AI路人 · Ai Luren — AI Video Creator，商业影像、创意短片与电影化视觉叙事作品集" />
</p>

<p align="center">
  用 AI 影像探索品牌表达、镜头语言与情绪叙事。<br>
  AI-assisted commercials, creative shorts and cinematic visual storytelling.
</p>

<p align="center">
  <a href="https://ailuren.netlify.app/"><strong>观看作品集 / Watch Films</strong></a>
  &nbsp; · &nbsp;
  <a href="https://ailuren.netlify.app/works.html">全部作品 / All Work</a>
  &nbsp; · &nbsp;
  <a href="https://ailuren.netlify.app/#profile">合作联系 / Contact</a>
</p>

---

## 精选影像 / Selected Films

四部真实作品封面。完整影片、原始显示比例及不同创意版本请前往作品集观看。

Four selected films — watch the complete videos and alternate cuts on the portfolio website.

<p align="center">
  <img src="./assets/images/project-covers/commercial/FormFunk Creative Commercial.webp" width="48%" alt="FormFunk 餐具创意广告 Demo 封面：蓝白植物印花浅盘" />
  &nbsp;
  <img src="./assets/images/project-covers/commercial/MEXC Member Perks.webp" width="48%" alt="MEXC 会员权益创意视频 Demo 封面" />
</p>
<p align="center"><sub>FORMFUNK · Creative Commercial Demo &nbsp; / &nbsp; MEXC · Member Perks Demo</sub></p>

<p align="center">
  <img src="./assets/images/project-covers/visual/The Hardest Goodbye.webp" width="48%" alt="《最难的告别》情绪叙事短片封面" />
  &nbsp;
  <img src="./assets/images/project-covers/commercial/Lenovo Brand Commercial.webp" width="48%" alt="联想品牌创意影像封面" />
</p>
<p align="center"><sub>THE HARDEST GOODBYE · Short Film &nbsp; / &nbsp; LENOVO · Brand Film</sub></p>

<p align="center"><a href="https://ailuren.netlify.app/#projects"><strong>浏览精选影像 / Explore Selected Films</strong></a></p>

<sub>说明：FormFunk、MEXC 作品为独立创意测试 / Demo，不代表品牌正式委托或官方发布。作品更新可能先于线上部署。</sub>

## 创作方向 / Creative Practice

- **品牌与商业影像 / Commercial Films** — AI TVC、品牌创意与文旅宣传片。
- **创意短片 / Creative Shorts** — 人物、情绪、故事与概念叙事。
- **产品与社媒影像 / Product & Social Films** — 产品表达、海外生活场景及多画幅内容。
- **视觉实验 / Visual Experiments** — 影像风格、镜头语言与视觉特效探索。

作品集支持分类浏览、中英双语、原始视频画幅与同一作品的多版本切换。

## 荣誉与展映 / Recognition

收录获奖、入围与公开展映记录，包括 Midjourney 官方优秀作品、美图未来 AI 设计大赛年度入围、联想 AI 创作先锋奖、海螺 AI LED 大屏展映，以及可灵、中国联通和 Pollo.ai 相关创作活动。各种记录按实际性质分别标注。

[查看荣誉与证明 / View Recognition](https://ailuren.netlify.app/#impact-awards)

## 影像之外 / Creative Tools

围绕日常 AI 影像创作与内容工作流开发的小工具：

- [Ainews-to-Feishu](https://github.com/Ai-luren/Ainews-to-Feishu) — AI 资讯整理及飞书同步。
- [Ailuren-illustrations](https://github.com/Ai-luren/Ailuren-illustrations) — 文章配图工具。
- [Image Comparison](https://github.com/Ai-luren/Image-comparison) — [在线图像对比](https://ai-luren.github.io/Image-comparison/)。

## 关于网站 / Behind the Portfolio

这是**个人 AI 视频作品展示网站**，不是在线 AI 视频生成平台。网站使用 Vite、React、Motion、OGL / WebGL，以及 GSAP / ScrollTrigger 实现部分滚动效果。

- **作品体验**：精选影像、完整作品库、影院播放器、视频版本切换、荣誉与双语导航。
- **本地作品工作台**：管理视频版本、顺序、3:4 作品封面与原比例播放器海报，不随网站部署。
- **媒体边界**：原始作品 MP4 不随 Git 提交。本地开发使用本地原片；正式网站使用已配置的线上视频地址。没有原片的克隆环境无法完整验证视频播放。

<details>
<summary><strong>本地运行 / Run Locally</strong></summary>

Node.js `^20.19.0` 或 `>=22.12.0`：

```bash
npm ci
npm run dev
```

网站：首页 <http://127.0.0.1:5174/> · 作品库 <http://127.0.0.1:5174/works.html>

本地作品工作台（需要 FFmpeg / FFprobe）：

```bash
npm run workbench
```

工作台：<http://127.0.0.1:5190/>。更改工作台服务代码后需重启；`npm run covers` 是兼容别名。

</details>

<details>
<summary><strong>项目结构与测试 / Structure & Checks</strong></summary>

```text
index.html · works.html      首页与完整作品库
src/                         React 组件、国际化与作品数据
assets/                      封面、海报与网站素材
portfolio-workbench/         本地作品工作台（不部署）
scripts/checks/              网站及工作台回归测试
docs/                        设计规范与维护指南
```

```bash
npm run build                   # 生产构建
npm run check:smoke             # 基础构建、目录与媒体安全
npm run check:cinema-controls   # 手机播放器交互
npm run check:cinema-local      # 本地视频缓冲与防黑屏
npm run check:cinema-version-motion # A/B 版本切换动画
npm run check:workbench-core    # 工作台核心回归
npm run check:i18n              # 中英文界面
```

维护文档：[文档索引](./docs/文档索引.md) · [设计规范](./docs/设计规范.md) · [作品库维护](./docs/作品库维护.md) · [工作台教程](./docs/本地封面工作台使用教程.md) · [AGENTS](./AGENTS.md)。

</details>

---

<p align="center">
  <a href="https://ailuren.netlify.app/"><strong>完整作品集 / Full Portfolio</strong></a>
  &nbsp; · &nbsp;
  <a href="https://ailuren.netlify.app/#profile">联系合作 / Contact</a>
  &nbsp; · &nbsp;
  <a href="./LICENSE">MIT License</a>
</p>

<p align="center"><sub>© 2026 AI路人 · Ai Luren · AI Video Creator</sub></p>
