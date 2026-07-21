# Ai路人｜深空创作舱

Ai路人的网页作品集，展示AI 图像与视频创作，以及围绕 AI 内容搭建的小工具。

这是一个可直接部署到 GitHub Pages 的单页作品集，采用 Vite + React + 原生 `index.html` 的混合架构。`index.html` 负责页面章节、全局样式、背景视频和部分滚动逻辑；`src/App.jsx` 负责启动 React，并把交互模块挂到页面预留节点。

线上地址：

- Netlify：<https://ailuren.netlify.app/>
- GitHub Pages：<https://ai-luren.github.io/>

## 本地运行

### 小白教程：从 GitHub 下载并运行

1. 安装 Node.js 22 LTS。当前依赖要求 Node.js `20.19.0` 或更高的 20.x，或 `22.12.0` 或更高的 22.x。

   ```bash
   node --version
   npm --version
   ```

2. 下载仓库并进入目录：

   ```bash
   git clone https://github.com/Ai-luren/Ai-luren.github.io.git
   cd Ai-luren.github.io
   ```

3. 按 lockfile 安装依赖并启动：

   ```bash
   npm ci
   npm run dev
   ```

4. 打开 <http://127.0.0.1:5173/>。不要双击 `index.html`，也不要使用 `file:///.../index.html`；视频、相对路径和 React 模块必须通过 Vite 服务器访问。

   如果 5173 端口被占用：

   ```bash
   npm run dev -- --port 5174
   ```

   然后打开 <http://127.0.0.1:5174/>。

## 构建验证

```bash
npm run build
git diff --check
```

构建产物输出到 `dist/`。项目使用相对资源路径，兼容 GitHub Pages 根地址和子路径部署。

看到 `built in ...ms` 表示构建成功。`dist/` 是构建产物，不要直接修改，也不要提交。

## Agent 保姆级工作流程

任何 Agent 接手项目时，按这个顺序做：

1. 阅读 `AGENTS.md`、`docs/设计规范.md` 和 `docs/交接说明.md`。
2. 执行 `git status --short`，确认没有覆盖用户未提交的修改。
3. 用 `rg` 搜索代码和资源引用，再决定修改或删除目标。
4. 修改完成后运行 `npm run build` 和 `git diff --check`。
5. 用 `http://127.0.0.1:5173/` 实际打开页面，至少检查桌面、390px 移动端、键盘焦点和 `prefers-reduced-motion`。
6. 只有用户明确要求时，才执行 commit、push、PR 或部署。

不要在 `dist/` 中改代码；不要覆盖用户现有未提交修改；不要把临时预览、token、`.env` 或 Agent 缓存提交进仓库。

## Agent skills 和插件

### 是否需要下载 skill 或插件？

不需要。项目运行只依赖 `package.json` 和 `package-lock.json` 中的 npm 依赖。任何 Agent 只要安装 Node.js、Git 和项目依赖，就可以启动和构建网页。

Skill 和插件属于 Agent 工作环境，不属于网页项目。不要为了运行网页把它们写进 `package.json`，也不要把插件缓存、token 或账号配置提交进仓库。

### 可选 skill

如果当前 Agent 环境已经提供这些 skill，可以按任务使用；没有也不影响项目运行：

| 任务 | 可选 skill | 用途 |
| --- | --- | --- |
| 视觉和页面改造 | `frontend-design` 或 `taste-skill:design-taste-frontend` | 保持明确的视觉方向 |
| GSAP 动画 | `gsap-core`、`gsap-timeline`、`gsap-react`、`gsap-scrolltrigger` | 修改动画、React 生命周期和滚动逻辑 |
| WebGL 效果 | 现有 OGL 代码和依赖文档 | 维护视频后处理和光泽效果 |
| 页面审查 | `web-design-guidelines` | 检查可访问性、响应式和交互 |
| GitHub 操作 | `github:github`、`github:yeet` | 查看仓库、提交、推送和创建 PR |

不要为了小改动引入新的框架、动效库或设计体系；skill 与 `AGENTS.md`、设计规范冲突时，以项目规范和用户要求为准。

## 目录速查

- `index.html`：单页内容、全局样式、滚动叙事和视频背景。
- `src/App.jsx`：React 入口。
- `src/components/MagneticProjectArchive.jsx`：精选创作档案卡片。
- `src/components/ImpactEvidence.jsx`：获奖作品、创作平台和内容发布模块。
- `assets/`：字体、图标和页面图片。
- `AI作品集封面/optimized/`：精选创作档案的 WebP 封面。
- `获奖截图/optimized/`：影响力模块使用的 WebP 获奖截图。
- `创作者LOGO/`、`社交媒体主页/`：平台 Logo 和内容发布证据图。
- `vendor/`：GSAP 与 ScrollTrigger 静态脚本。
- `hero.mp4`：全站深空背景视频。
- `hero-mobile.mp4`：移动端背景视频。
- `docs/`：当前规范和交接说明。

## 页面结构和修改入口

| 需求 | 优先查看 |
| --- | --- |
| 页面章节、标题、全局样式、背景视频 | `index.html` |
| 精选创作档案卡片 | `src/components/MagneticProjectArchive.jsx` |
| 获奖截图、平台 Logo、社交平台证据 | `src/components/ImpactEvidence.jsx` |
| 页脚社交入口和复制操作 | `src/components/FloatingDock.jsx`、`index.html` |
| AI 实验室翻牌卡片 | `src/components/ExperimentFlip.jsx` |
| Hero 标题和操作按钮 | `src/components/HeroTitle.jsx`、`src/components/HeroActions.jsx` |
| 背景视频 WebGL 后处理 | `src/components/VideoPostProcess.jsx` |
| 工作经历视觉层和五段滚动经历 | `src/components/ExperienceGlareLayers.jsx`、`index.html` |
| 设计规则 | `docs/设计规范.md` |
| 运行时结构和维护风险 | `docs/交接说明.md` |

## 依赖和常用命令

主要依赖：React 19、Vite、GSAP、Motion 和 OGL。完整版本以 `package-lock.json` 为准。

```bash
npm ci            # 按 lockfile 安装依赖
npm run dev       # 启动本地开发服务器
npm run build     # 构建生产版本
npm run preview   # 预览 dist 构建结果
git diff --check  # 检查补丁格式问题
```

## 部署说明

推送到 `main` 后，GitHub Actions 会自动安装 Node.js 22、执行 `npm ci` 和 `npm run build`，再把 `dist/` 发布到 GitHub Pages。部署配置位于 `.github/workflows/deploy-pages.yml`。除非用户明确要求，不要修改部署配置、环境变量、权限或 GitHub Actions。

Netlify 也已连接此 GitHub 仓库：推送或合并到 `main` 后，会使用 `npm run build` 构建并发布 `dist/`，更新 [ailuren.netlify.app](https://ailuren.netlify.app/)。Pull Request 会生成预览部署。

## 修改原则

先阅读 [`AGENTS.md`](AGENTS.md)、[`docs/设计规范.md`](docs/设计规范.md) 和 [`docs/交接说明.md`](docs/交接说明.md)，再修改页面。页面改动完成后必须执行构建验证。
