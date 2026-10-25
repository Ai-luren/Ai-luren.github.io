# 项目协作规则

## 目标

维护可部署到 GitHub Pages、Cloudflare Pages、Vercel 和 Netlify 的 Vite 作品集，包含首页与独立作品库，保证桌面与移动端可访问、构建稳定。

## 结构

- `index.html`：页面结构、文案、全局样式、动画和媒体背景。
- `src/App.jsx`：React 入口，只挂载交互组件。
- `src/components/`：作品档案、影响力模块及其样式。
- `src/data/projects.js`：15 件作品的唯一数据源；`PROJECTS` 是完整库顺序，`FEATURED_PROJECT_IDS` 独立控制首页八件精选及播放器顺序。无真实资料时保留空值。
- `assets/videos/works/`：本地原始作品视频，Vite 开发模式下始终优先使用这些本地文件（不请求 ImageKit）；Git 忽略且不进入正式构建。分类按商业广告、创意短片、海外产品广告、视觉实验管理。
- `works.html`、`src/works-main.jsx`：独立作品库的 Vite 多入口页面；站内链接使用相对路径，保持 GitHub Pages 子路径兼容。
- `assets/`、`vendor/`：图标、视频和第三方静态资源；页面使用系统字体栈，不依赖远程字体 CDN。
- `docs/`：`设计规范.md` 是唯一持续生效的视觉与交互规范；维护指南为操作说明，带日期的审计/验收文档只作历史记录。
- `tools/cover-studio/`：独立本地封面工具，使用本机 FFmpeg 与独立环回端口，不接入正式 Vite 构建或部署。
- `.cover-studio/`：工具导入的视频副本、候选帧、导出及关联历史，只保留在本地；不自动清理。确认关联后的新封面位于 `assets/images/project-covers/custom/`，映射在 `src/data/project-cover-overrides.json`，保留原封面文件。
- 项目封面和播放器海报文件名以 `src/data/projects.js` 中的中文作品名为准；获奖图片文件名以 `src/components/ImpactEvidence.jsx` 中的中文奖项/作品名为准。作品库原始封面使用中文作品名，替换封面和播放器海报在中文名后附导出 ID 或内容哈希以保留版本区分。

## 规则

- 优先复用现有字体、颜色、间距和玻璃面板，不引入无必要的视觉体系。
- 修改 CSS 前先确认规则归属：Hero、共享 Token、导航、玻璃和作品库拥有各自文件；禁止复制旧版调参器或无必要地在 `index.html`、共享 CSS 中叠加同选择器覆盖。
- 导航响应式契约：**761px 及以上首页与全部作品页都展开同一套四项文字导航**；760px 及以下才使用汉堡菜单。保持导航玻璃胶囊、品牌、语言按钮、影院/获奖弹窗共用导航规则，不为平板单独创建导航实现。
- 打开手机菜单时，焦点必须进入模态菜单，Tab/Shift+Tab 不得离开菜单内容；关闭后恢复正常焦点和页面滚动。从 ≤760px 调整到 ≥761px 时应立即关闭已打开或正在关闭的菜单、恢复 inert/滚动锁并让文字导航可操作。执行 `npm run check:nav-modal-breakpoints`。
- 获奖素材「海螺AI动物跳水.webp」原图右侧有约 2–3px 明亮接缝；只能在对应获奖图片查看器中按比例裁切，保持其他获奖图、查看器圆角、媒体尺寸不变。素材更新后重新检查，执行 `npm run check:award-edge`。
- 三类共享查看器（作品播放器、获奖荣誉、AI 自媒体资料）共用缓动曲线：进入 260ms、退出 220ms、内容轻微位移 8px；保持背景模糊层独立且固定，不对子容器以外的导航胶囊使用 transform。关闭时播放器立即停止媒体，退出后才解除模态、恢复滚动和焦点；减少动态效果时不等待。运行 `npm run check:modal-motion`。
- 保持 GitHub Pages 相对路径构建方式，不修改部署配置或环境变量。
- 不提交简历、提示词、过程记录、临时预览页或过期设计方案。
- 页面内容和视觉调整完成后，必须执行构建验证。
- 修改文案、字号、行宽、容器宽度等影响排版的内容后，必须执行双语布局检测。
- 双语文案约定：英文标题尽量 ≤ 26 字符、导航标签 ≤ 8 字符，避免触发为长文案准备的降级规则。
- 维护首页精选顺序只编辑 `src/data/projects.js` 的 `FEATURED_PROJECT_IDS`，不要把它写成 `PROJECTS.slice(0, 8)`；改动后运行 `npm run check:curated-order`，并保持全部作品库原始顺序。
- 删除资源前先确认它没有被页面、组件或构建配置引用。
- 改海外产品（ID 09–13）标题或本地文件名时，须同步默认封面、custom 映射、播放器海报、原片路径、封面工作台记录与回归测试；**ImageKit 生产 URL 不能随本地重命名改变**。步骤见 `docs/播放器媒体维护.md`，检查 `check:overseas-names` 和 `check:hero-first-frame`。
- 在本机 Vite 开发模式下，`src/data/projects.js` 的作品播放器使用 `assets/videos/works/` 中的本地 MP4；即使已配置 ImageKit URL 也不能走线上 CDN。没有本地原片时不要自动回退访问 ImageKit。正式构建仍保持 ImageKit 原始视频链接。
- **零 ImageKit CDN 消耗是自动化测试的硬性约束**：日常测试、截图、UI 检查、回归测试禁止向 ImageKit 发起真实网络请求；不要为了测试布局访问线上作品视频。
- 所有使用 Playwright 的脚本必须通过 `scripts/lib/safe-media.mjs` 的 `createSafePage` / `createSafeContext` 创建受保护的页面或上下文；这些辅助函数在导航和播放前拦截 ImageKit 请求，MP4 由 `scripts/fixtures/` 本地小视频替代，其他 ImageKit 请求直接阻断。新测试也必须遵守。不能调用 `route.continue()` 绕过该保护。
- 自动测试使用本地模拟媒体验证播放器状态、尺寸和导航；真实 CDN 播放检查只能在用户**明确授权**后单独手动执行，绝不自动回退到真实视频。不得改动生产环境 `tr:orig-true`、点击后加载及 `preload="none"` 的行为。


## 验证

```bash
npm run build
npm run check:media-safety
npm run check:curated-order
npm run check:modal-motion
npm run check:hero-published
npm run check:hero-first-frame
npm run check:webgl-recovery
npm run check:clipboard
npm run check:i18n
node scripts/check-project-library.mjs
git diff --check
```

封面工具相关改动另运行 `node scripts/check-cover-studio.mjs`，只在隔离临时项目中验证导出与替换，不使用真实作品封面做自动验收写入。

本地开发必须先启动 `npm run dev`，再访问固定地址 `http://127.0.0.1:5174/`（生产预览使用 `npm run preview` 和 5181 端口）；不要直接打开 `index.html`，否则 React 挂载、资源路径和动态模块可能不完整。

`check:i18n` 说明（`scripts/check-i18n.mjs`）：
- 双语言 × 手机/桌面两种视口全页滚动扫描，检测视口溢出与文字被裁剪。
- 含专项断言：导航语言按钮在 393/375/360px 的适配、Hero 标题超视口、work 区卡片对齐、作品卡片文字压图、二维码弹窗居中、作品卡片 kick 标签与底部奖项文字不截断（375/360px 同测）、data-i18n 元素不显示 key 原文。
- 检查三个 AI 影响力章节共用的标题-面板上下顺序与间距，以及模块间距一致性。
- 依赖 `playwright-core`（devDependency）驱动系统已装的 Chrome 或 Edge，不额外下载浏览器。
- 忽略名单收录设计上故意溢出的元素（logo 走马灯、奖状轮播 peek、按钮扫光层）；新增故意溢出的设计时需同步更新脚本忽略名单。

## 文档入口

- `docs/文档索引.md`：**文档总导航**，区分当前维护手册和已过期历史快照。
- `README.md`：GitHub 面向访客的真实作品展示、项目简介与最小启动说明；不是内部完整运维手册。
- `docs/设计规范.md`：当前生效的视觉和交互规则。
- `docs/交接说明.md`：运行时结构、关键入口和维护注意事项。
- `.audit/docs-history/`：本地只读历史审计（设计系统验收、Step07 转化审计），**不是当前设计规范**；Git 中旧版本仍可通过提交历史找回。
- `docs/作品库维护.md`、`docs/影院导航维护.md`、`docs/播放器媒体维护.md`：作品数据、影院交互与媒体元数据维护。
- `docs/本地封面工作流.md`、`docs/本地封面工作台使用教程.md`：本地封面工具流程和操作说明。
