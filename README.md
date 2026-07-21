# Ai路人｜深空创作舱

Ai路人的个人作品集，展示 AI 图像、视频创作、AI 实验和可复用的创意工作流。

这是一个可部署到 GitHub Pages 的单页网站，使用 Vite + React 19 与原生 `index.html` 混合架构：

- `index.html`：页面章节、全局样式、背景视频和原生滚动逻辑。
- `src/`：React 入口、交互组件和 GSAP 运行时逻辑。
- `assets/`：所有运行时图片、视频和字体。

## 在线地址

- GitHub Pages：<https://ai-luren.github.io/>
- Netlify：<https://ailuren.netlify.app/>

## 本地运行

需要 Node.js 22 LTS，或满足项目依赖要求的 Node.js 20/22 版本。

```bash
npm ci
npm run dev
```

然后打开终端显示的本地地址，通常是 <http://127.0.0.1:5173/>。

不要双击 `index.html`，也不要使用 `file://` 打开；视频、相对路径和 React 模块需要通过 Vite 服务器加载。

## 构建与预览

```bash
npm run build
npm run preview
git diff --check
```

`npm run build` 会生成 `dist/`。`dist/` 是临时构建产物，不直接修改，也不提交到 GitHub。

构建时可能看到 Vite 关于 `vendor/` 普通脚本无法打包的提示。这两个脚本是通过 HTML `<script>` 加载的现有运行时依赖，不影响当前构建结果。

## 目录结构

```text
.
├── .github/workflows/       GitHub Pages 部署工作流
├── .netlify/                Netlify 本地状态目录
├── assets/
│   ├── fonts/               页面字体
│   ├── images/
│   │   ├── awards/          获奖截图
│   │   ├── icon/            联系方式和社交图标
│   │   ├── platform-logos/  AI 平台 Logo
│   │   ├── project-covers/  精选创作封面
│   │   └── social-profiles/ 社交平台主页截图
│   ├── videos/              桌面端和移动端背景视频
│   └── work-history-illustrations/ 工作经历插画
├── docs/                    设计规范和交接说明
├── src/
│   ├── components/          React 组件及其样式
│   ├── styles/              共享样式
│   └── gsap-runtime.js      GSAP 加载与降级逻辑
├── vendor/                  GSAP 和 ScrollTrigger 静态脚本
├── index.html               单页入口
├── package.json              npm 依赖和命令
├── package-lock.json         依赖锁定文件
└── vite.config.js            Vite 配置
```

## 修改入口

| 需求 | 文件 |
| --- | --- |
| 页面章节、全局样式、背景视频 | `index.html` |
| 精选创作档案 | `src/components/MagneticProjectArchive.jsx` |
| 获奖、平台和社交证据 | `src/components/ImpactEvidence.jsx` |
| 页脚联系方式 | `src/components/FloatingDock.jsx`、`index.html` |
| AI 实验室卡片 | `src/components/ExperimentFlip.jsx` |
| Hero 标题和按钮 | `src/components/HeroTitle.jsx`、`src/components/HeroActions.jsx` |
| 视频 WebGL 后处理 | `src/components/VideoPostProcess.jsx` |
| 工作经历视觉层 | `src/components/ExperienceGlareLayers.jsx`、`index.html` |

## 维护流程

1. 先阅读 `AGENTS.md`、`docs/设计规范.md` 和 `docs/交接说明.md`。
2. 修改前运行 `git status --short`，确认没有覆盖其他未提交改动。
3. 修改资源时，统一放入 `assets/` 对应子目录，并同步更新引用。
4. 修改完成后执行 `npm run build` 和 `git diff --check`。
5. 需要发布时使用功能分支和 Pull Request，不直接修改受保护的 `main`。

## 部署

推送并合并到 `main` 后，GitHub Actions 会执行：

```text
npm ci → npm run build → 上传 dist/ → 部署 GitHub Pages
```

部署配置位于 `.github/workflows/deploy-pages.yml`。除非明确需要，不修改部署配置、环境变量或权限设置。

Netlify 也已连接此 GitHub 仓库：推送并合并到 `main` 后，会使用 `npm run build` 构建并发布 `dist/`，更新 [ailuren.netlify.app](https://ailuren.netlify.app/)。Pull Request 会生成预览部署。

## 清理规则

- `dist/`：构建时自动生成，可删除，不提交。
- `node_modules/`：本地依赖，可通过 `npm ci` 恢复，不提交。
- `.DS_Store`、`.audit/`、`.impeccable/`、`.uploads/`：本地系统或审查缓存，不提交。
- `.netlify/`：当前保留，用于 Netlify 本地状态；不提交敏感信息。
