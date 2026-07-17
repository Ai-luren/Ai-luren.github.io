# Ai路人｜深空创作舱

面向面试官、猎头和合作方的单页作品集，展示动态设计、AI 图像与视频创作，以及围绕 AI 内容搭建的小工具。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器默认使用 `http://127.0.0.1:5173/`。

## 构建验证

```bash
npm run build
git diff --check
```

构建产物输出到 `dist/`。项目使用相对资源路径，适合部署到 GitHub Pages 子路径。

## 目录速查

- `index.html`：单页内容、全局样式、滚动叙事和视频背景。
- `src/App.jsx`：React 入口。
- `src/components/MagneticProjectArchive.jsx`：精选创作档案卡片。
- `src/components/ImpactEvidence.jsx`：获奖作品、创作平台和内容发布模块。
- `assets/`：字体、图标和页面图片。
- `public/vendor/`：GSAP 与 ScrollTrigger 静态脚本。
- `hero.mp4`：全站深空背景视频。
- `docs/`：当前规范和交接说明。

## 修改原则

先阅读 [`AGENTS.md`](AGENTS.md)、[`docs/设计规范.md`](docs/设计规范.md) 和 [`docs/交接说明.md`](docs/交接说明.md)，再修改页面。页面改动完成后必须执行构建验证。
