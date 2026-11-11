<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="AI路人 Ai Luren｜AI 视频创作者的商业影像、创意短片与视觉叙事作品集" />
</p>

<p align="center">
  以 AI 影像探索品牌表达、人物故事与电影化视觉。<br>
  AI-assisted commercials, creative films and cinematic visual storytelling.
</p>

<p align="center">
  <a href="https://ailuren.netlify.app/"><strong>观看作品 / Watch Films</strong></a>
  &nbsp; · &nbsp;
  <a href="https://ailuren.netlify.app/works.html">全部作品 / All Work</a>
  &nbsp; · &nbsp;
  <a href="https://ailuren.netlify.app/#profile">合作联系 / Contact</a>
</p>

<p align="center"><sub>商业影像 · 创意短片 · 海外产品广告 · 视觉实验 &nbsp; / &nbsp; 中英双语</sub></p>

---

## 精选影像 / Selected Films

四部代表作品，涵盖产品视觉、品牌创意与情绪叙事。完整视频和多版本作品可在网站内观看。

<p align="center">
  <img src="./assets/images/project-covers/commercial/FormFunk Creative Commercial.webp" width="49%" alt="FormFunk 餐具创意影像 Demo：蓝白印花餐盘与极简视觉场景" />
  <img src="./assets/images/project-covers/commercial/MEXC Member Perks.webp" width="49%" alt="MEXC 会员权益创意测试：商业广告概念影像" />
</p>
<p align="center"><sub>01 / FormFunk · Demo　　　02 / MEXC · Demo</sub></p>

<p align="center">
  <img src="./assets/images/project-covers/visual/The Hardest Goodbye.webp" width="49%" alt="《最难的告别》情绪叙事影像封面" />
  <img src="./assets/images/project-covers/commercial/Lenovo Brand Commercial.webp" width="49%" alt="联想 AI 品牌创意影像封面" />
</p>
<p align="center"><sub>03 / 最难的告别　　　04 / 联想品牌影像</sub></p>

<p align="center"><a href="https://ailuren.netlify.app/#projects"><strong>浏览精选作品 / Explore Selected Films</strong></a></p>

<sub>说明：FormFunk 与 MEXC 为创意测试 / Demo，不代表相关品牌的正式委托或官方广告。网页可能尚未部署本地新增的版本。</sub>

## 创作方向 / Creative Practice

- **品牌与商业广告 / Commercial Films** — 品牌传播、AI TVC、视觉创意及文旅影像。
- **创意短片 / Creative Shorts** — 人物、情绪、故事与概念叙事。
- **海外产品与社媒影像 / Product & Social** — 产品展示、生活场景与多比例内容。
- **视觉实验 / Visual Experiments** — 影像风格、镜头语言与视觉特效探索。

作品库支持按分类浏览，保留影片原始画幅；同一作品可切换不同的视频版本，桌面与手机均支持中英文界面。

## 荣誉与展映 / Recognition

作品集收录 8 项独立的获奖、入围或公开展映记录，包括 Midjourney 官方优秀作品、美图未来 AI 设计大赛年度入围、联想 AI 比赛创作先锋奖、海螺 AI LED 大屏展映、可灵无限剧场小赛、中国联通「海纳星火计划」两件独立三等奖作品，以及 Pollo.ai 影视级特效小赛优秀奖。

[查看荣誉与证明 / View Recognition](https://ailuren.netlify.app/#impact-awards) — 将获奖、入围和展映分别标注，不混为一谈。

## 影像之外 / Beyond the Films

我也在开发与创作流程有关的小工具，用于搜集资讯、制作内容和比较视觉素材。

- [Ainews-to-Feishu](https://github.com/Ai-luren/Ainews-to-Feishu) — AI 资讯追踪与飞书同步。
- [Ailuren-illustrations](https://github.com/Ai-luren/Ailuren-illustrations) — AI 文章配图。
- [Image Comparison](https://github.com/Ai-luren/Image-comparison) — [在线比较图像](https://ai-luren.github.io/Image-comparison/)。

## 关于这个网站 / About the Portfolio

这是我的**个人 AI 视频作品集**，不是在线 AI 视频生成平台。网站采用 **Vite · React · GSAP / ScrollTrigger · OGL / WebGL · ImageKit**，重点是让访客快速浏览作品、播放原始画幅影像、切换视频版本，以及查看创作经历。

本地还配套一个独立的 **Portfolio Workbench（作品工作台）**，用于整理作品、封面和播放器海报、拖拽排序与可恢复归档；它不参与正式网站构建。

<details>
<summary><strong>本地运行与开发 / Run Locally</strong></summary>

需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm ci
npm run dev
```

首页：<http://127.0.0.1:5174/> · 作品库：<http://127.0.0.1:5174/works.html>

启动本地作品工作台（需 FFmpeg / FFprobe）：

```bash
npm run workbench
```

工作台：<http://127.0.0.1:5190/>。旧命令 `npm run covers` 保留兼容；修改工作台代码后需重启服务，并运行 `npm run check:workbench-live`。

**媒体说明：** Git 仓库不包含本地原始作品 MP4（`assets/videos/works/`）。开发模式优先使用本地视频，不会在缺片时自动请求 ImageKit；正式发布版使用配置的线上视频地址。克隆仓库后若没有原片，部分视频无法在本地直接播放。

</details>

<details>
<summary><strong>目录结构与测试 / Repository & Checks</strong></summary>

```text
index.html · works.html         首页与完整作品库
src/                            网站交互组件与作品数据
assets/                         封面、海报、视觉与媒体素材
portfolio-workbench/            本地作品工作台（不部署）
scripts/checks/site/            网站回归测试
scripts/checks/workbench/       工作台隔离测试
scripts/lib/ · scripts/fixtures/ 共用测试工具及素材
docs/                           设计规范与维护手册
```

```bash
npm run check:smoke            # 基础构建、目录、素材与媒体安全
npm run check:repo-layout      # 检查目录与依赖路径
npm run check:workbench-core   # 工作台核心回归
npm run check:workbench-create # 新建作品与双封面保存
npm run check:workbench-live   # 已启动工作台的真实浏览器验收
npm run check:i18n             # 中英文界面检查
```

更多维护约定：[文档索引](./docs/文档索引.md) · [设计规范](./docs/设计规范.md) · [工作台使用教程](./docs/本地封面工作台使用教程.md) · [AGENTS](./AGENTS.md)。

</details>

---

<p align="center">
  <a href="https://ailuren.netlify.app/"><strong>观看完整作品集 / Full Portfolio</strong></a>
  &nbsp; · &nbsp;
  <a href="https://ailuren.netlify.app/#profile">联系合作 / Contact</a>
  &nbsp; · &nbsp;
  <a href="./LICENSE">MIT License</a>
</p>

<p align="center"><sub>© 2026 AI路人 · Ai Luren · AI Video Creator</sub></p>
