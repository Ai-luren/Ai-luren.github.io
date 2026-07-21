# Ai路人｜深空创作舱

Ai路人的个人作品集，展示 AI 图像、视频创作、AI 实验和可复用的创意工作流。

这是一个可部署到 GitHub Pages 的单页网站，使用 Vite + React 19 与原生 `index.html` 混合架构：

- `index.html`：页面章节、全局样式、背景视频和原生滚动逻辑。
- `src/`：React 入口、交互组件和 GSAP 运行时逻辑。
- `assets/`：所有运行时图片、视频和字体。

## 在线地址

- GitHub Pages：<https://ai-luren.github.io/>（中国大陆网络无法直连）
- Vercel：<https://ailuren.vercel.app/>（中国大陆网络无法直连）
- Cloudflare Pages：<https://ailuren.pages.dev/>（中国大陆网络可直连）
- Netlify：<https://ailuren.netlify.app/>（中国大陆网络可直连）

> 国内访问建议优先使用 Cloudflare Pages 或 Netlify；GitHub Pages 和 Vercel 在中国大陆网络环境下无法直连。

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

## 部署教程与自动部署

四个平台都部署同一个 GitHub 仓库：`Ai-luren/Ai-luren.github.io`。统一配置如下：

- 生产分支：`main`
- 构建命令：`npm run build`
- 发布目录：`dist`
- 根目录：`/`

### GitHub Pages

项目已经包含 `.github/workflows/deploy-pages.yml`，使用 GitHub Actions 构建并发布 `dist/`。

首次配置：

1. 打开 GitHub 仓库的 `Settings → Pages`。
2. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
3. 将改动通过 Pull Request 合并到 `main`，或在 Actions 页面手动运行 `Deploy GitHub Pages`。
4. 部署完成后访问 <https://ai-luren.github.io/>。

官方文档：<https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>

### Vercel

1. 打开 Vercel，选择 `Add New → Project`。
2. 导入 GitHub 仓库 `Ai-luren/Ai-luren.github.io`。
3. Framework Preset 选择 `Vite`，确认构建命令为 `npm run build`，输出目录为 `dist`。
4. 点击 `Deploy`。
5. 在 `Settings → Domains` 中管理默认域名；当前地址是 <https://ailuren.vercel.app/>。

之后每次将改动合并到 `main`，Vercel 会自动创建并发布生产部署。Pull Request 会生成预览部署。

官方文档：<https://vercel.com/docs/deployments/git>

### Cloudflare Pages

1. 打开 Cloudflare Dashboard，进入 `Workers & Pages → Create application → Pages`。
2. 选择 `Connect to Git`，授权 GitHub 并选择 `Ai-luren/Ai-luren.github.io`。
3. 生产分支填写 `main`。
4. 构建命令填写 `npm run build`，构建输出目录填写 `dist`。
5. 点击 `Save and Deploy`。
6. 部署完成后访问 <https://ailuren.pages.dev/>。

之后每次将改动合并到 `main`，Cloudflare Pages 会自动构建并更新；Pull Request 也可以生成预览部署。

官方文档：<https://developers.cloudflare.com/pages/configuration/git-integration/>

### Netlify

1. 打开 Netlify，选择 `Add new project → Import an existing project`。
2. 连接 GitHub 并选择 `Ai-luren/Ai-luren.github.io`。
3. 生产分支填写 `main`。
4. 构建命令填写 `npm run build`，发布目录填写 `dist`。
5. 点击 `Deploy`。
6. 仓库根目录的 `netlify.toml` 已保存相同配置；部署完成后访问 <https://ailuren.netlify.app/>。

之后每次将改动合并到 `main`，Netlify 会自动构建并更新；Pull Request 会生成预览部署。

官方文档：<https://docs.netlify.com/site-deploys/create-deploys/>

### 发布建议

当前 `main` 受保护，推荐流程是：

```text
修改代码 → npm run build → git diff --check → 创建 Pull Request → 检查预览 → 合并到 main → 四个平台自动部署
```

国内访问建议优先使用 Cloudflare Pages 或 Netlify；GitHub Pages 和 Vercel 在中国大陆网络环境下无法直连。

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

## 清理规则

- `dist/`：构建时自动生成，可删除，不提交。
- `node_modules/`：本地依赖，可通过 `npm ci` 恢复，不提交。
- `.DS_Store`、`.audit/`、`.impeccable/`、`.uploads/`：本地系统或审查缓存，不提交。
- `.netlify/`：当前保留，用于 Netlify 本地状态；不提交敏感信息。
