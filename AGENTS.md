# 项目协作规则

## 目标

维护可部署到 GitHub Pages、Cloudflare Pages、Vercel 和 Netlify 的 Vite 作品集，包含首页与独立作品库，保证桌面与移动端可访问、构建稳定。

## 结构

- `index.html`：页面结构、文案、全局样式、动画和媒体背景。
- `src/App.jsx`：React 入口，只挂载交互组件。
- `src/components/`：作品档案、影响力模块及其样式。
- `src/data/projects.js` 汇总原有作品与 `auto-projects.json`，`project-order.json` 分别维护全部顺序和独立八件精选；无证据的奖项不填。
- `auto-projects.json` 管理新增作品与版本，旧版来源、视频 URL、归档分别见 `legacy-video-variants.json`、`legacy-imagekit-urls.json`、`archive-state.json`；禁止物理删除素材。
- `assets/videos/works/` 是 Git 忽略的本地原片，开发环境禁回退 ImageKit；公开作品播放器按点击加载云端 MP4。
- `works.html`、`src/works-main.jsx`：独立作品库的 Vite 多入口页面；站内链接使用相对路径，保持 GitHub Pages 子路径兼容。
- `assets/`、`vendor/`：图标、视频和第三方静态资源；页面使用系统字体栈，不依赖远程字体 CDN。
- `ARCHITECTURE.md`：新工程师的入口与职责地图；`docs/作品数据字典.md`：项目 JSON 真值、优先级与工作台写入边界；`docs/历史代码待清理清单.md`：待验证的历史债，不代表可删除。
- `docs/`：`设计规范.md` 是公开网页的唯一视觉与交互规范；工作台专属规则见 `docs/本地封面工作流.md`，维护指南为操作说明，带日期的审计/验收文档只作历史记录。
- `portfolio-workbench/`：本地作品工作台，使用 FFmpeg、环回端口和可恢复的归档索引维护作品；不接入正式 Vite 构建或部署。
- `scripts/checks/site/`、`scripts/checks/workbench/` 复用 `scripts/lib/safe-media.mjs`、本地夹具；移动测试脚本同步入口和 `check:repo-layout`。
- `.cover-studio/`：本地导入副本、候选帧、封面替换与改名历史、迁移前媒体备份；被 Git 忽略，不能当缓存清空。
- 3:4 封面和各版原比例海报分别归 `assets/images/project-covers/`、`assets/images/player-posters/`，遵循四分类目录；改名需同步 MP4/图片/JSON 并保留历史，不改 ImageKit URL。

## 规则

- **设计系统**：复用 `src/styles/card-surfaces.css`、`docs/设计规范.md` 的 D+ 玻璃 Token；按内容密度控制透明度，禁止重复模糊与重叠覆盖。
- **CSS 归属**：先找到生效源文件，不在 HTML 与共享 CSS 中叠加旧选择器。
- **首帧/深链布局**：保留 HTML 的 after-top、after-projects、outro 电影穿行间隔及 React 门户 :empty 预留；禁止运行时二次插入导致 CLS。
- **Hero/封面**：≤760px 用 13.83s C 正向光学溶接循环，`?heroMode=scrub` 保留原 15s；桌面滚动驱动，作品视频仅点击后加载。精选首排即加载，其余 1100px 预取，不叠原生 lazy。详见 `docs/播放器媒体维护.md`。
- **Cloudflare Pages Range**：仅 `*.pages.dev` 的桌面 Hero seek 和 `?heroMode=scrub` 使用 GitHub Pages 同 hash MP4（支持 HTTP 206），手机 C 继续本平台自动循环；PR 修改视频 hash 而 main 镜像未同步时可能 404，先核验源版本，不要重复在线播放。详见 `docs/交接说明.md`。
- **滚动恢复**：浏览器原生 `history.scrollRestoration=auto`；禁止 load/pageshow 强制回顶或用户滚动后锁定，回归 `check:home-scroll`、`check:nav-scroll`。
- **导航断点**：≥761px 首页/作品库均为同一四项文字导航，≤760px 为手机菜单；作品库「首页」返回 `./index.html#top`，「精选」跳 `#projects`。弹窗共享头像导航与语言逻辑。
- **深链语义**：`works.html?watch=ID` 仅打开海报，Back/Forward 可关闭/重开；`?project=ID` 只供工作台定位。首页不改 URL，不恢复复制作品链接 UI。
- **影院作品目录**：入口在分类标签旁，底部只保留居中作品切换组；目录属于现有 dialog。≥1320px 且高≥601px 非模态侧栏，不得移动画面、锁定播放/切片；其它断点临时覆盖，手机底部选片后收起。6 项筛选保持可见且默认继承当前来源。详见 `docs/播放器媒体维护.md`，回归 `check:cinema-work-directory`。
- 获奖画廊固定八张：≥1280px 八列，其余四列两排；手机卡片仅图片，文字进入查看器。
- AI 实验室三项目共享导航和真实素材；移动站外链接走 `ExternalLinkSheet` 确认，见 `docs/AI实验室与外链维护.md`。
- **手机菜单焦点**：模态时约束 Tab/Shift+Tab 与滚动；跨越 760/761px 断点时解除 inert/滚动锁并恢复导航，回归 `check:nav-modal-breakpoints`。
- **双页面手机菜单**：统一四项导航、四条社媒、Logo/语言/关闭控件及≥44px 触控区；复用 `MobileMenuSocialLinks.jsx`、`navigation.css`，回归 `check:shared-mobile-menu`。
- 「海螺AI动物跳水.webp」右边接缝只能在对应查看器内裁切，不影响其他奖项，回归 `check:award-edge`。
- **共享弹窗动效**：作品/荣誉/自媒体查看器进场 260ms、退场 220ms、轻位移 8px；关闭立即停媒体，结束后恢复焦点与滚动，回归 `check:modal-motion`。
- 保持 GitHub Pages 相对路径构建方式，不修改部署配置或环境变量。
- 不提交简历、提示词、过程记录、临时预览页或过期设计方案；公开 README 使用真实、已存在的作品图和证明，创意测试或独立 Demo 必须明确标注，不得冒充正式委托。
- 页面内容和视觉调整完成后，必须执行构建验证。
- 修改文案、字号、行宽、容器宽度等影响排版的内容后，必须执行双语布局检测。
- 双语文案应保持自然且语义一致，避免单词间双空格；导航标签保持紧凑，作品英文标题可换行，不能为凑字数强行缩写品牌或片名。
- 首页精选固定 8 件且可换成员，与 `project-order.json` 的 `all` 独立；卡片拖拽自动保存/可撤销，不能锁定全部作品前八件或用 `PROJECTS.slice(0,8)`。回归 `check:curated-order`、`check:work-cards`。
- 删除资源前先确认它没有被页面、组件或构建配置引用。
- **素材重命名**：本地 MP4、两类封面及 JSON 必须原子同步并可恢复；ImageKit URL 不跟随更名，回归 `check:asset-catalog`。
- **媒体历史**：每版播放器海报独立保存并核对比例、备份旧图；旧 `generate-player-media.mjs` 已退休，统一用工作台，回归 `check:cover-poster`。
- **自动化零媒体计费**：自动化、截图、后台审计和线上预览禁止向 ImageKit 发出任何真实媒体/缩略图/转码请求或调用其付费 API；不可依赖配额上限作拦截。单次真实媒体核验须先说明带宽/VPU 成本、获得用户批准。详见 `docs/测试与回归维护.md`。
- **Playwright 先拦截**：仓库脚本统一使用 `scripts/lib/safe-media.mjs`；临时脚本同样在导航前于 browser context 层拦截全部 `*.imagekit.io`（HTTP/S、查询参数），不得裸跑或只靠 `.mp4`/`resourceType=media` 过滤。先离线验证拦截。
- **第三方计费防护**：Netlify/Cloudflare/GitHub Pages Hero 带宽也可能产生费用或配额压力；批量测试/媒体嗅探/截图先用本地构建与夹具。异常时停测查日志，未经批准不动收费、缓存和线上配置。
- **ImageKit 后台可能计费**：Media Library、Media use analysis、视频详情可能隐式请求 `ik-thumbnail.jpg` 产生 VPU；禁止自动批量访问/刷新，优先只读 usage API 或用户截图。
- 云端播放前缀 `tr:orig-true`、按点击才加载、`preload="none"` 均为生产媒体约束；不可因离线回归改变。


## 验证与维护

- **验证分级**：`check:plan` 只读，`check:smoke` + `check:workbench-core` = `check:project`，上线用 `check:site-full` / `check:workbench-full`；唯一队列 `scripts/lib/check-suite-catalog.mjs`。删旧测试前迁移独有断言。
- **专项回归**：`npm run build`，按模块选择 `check:media-safety`、`check:home-scroll`、`check:cinema-local`、`check:cinema-controls`、`check:i18n`，最后 `git diff --check`。
- **运行**：本地启动 `npm run dev` 后访问 `http://127.0.0.1:5174/`；正式预览用 `npm run preview`，不能直接打开 `index.html` 文件。
- `.audit/` 仅本地保存报告和素材对照，不属于部署文件；旧记录见 `.audit/README.md`，不得清空。旧 Git 分支及不可达对象须核实恢复价值后才能清理。

## 文档入口

- `docs/文档索引.md` 为总导航；`README.md` 面向访客，`docs/设计规范.md` 是当前视觉规范，`docs/交接说明.md` 为开发与部署手册。
- `docs/作品库维护.md` 管理作品及排序；`docs/播放器媒体维护.md` 管理视频和影院；`docs/本地封面工作流.md` 为工作台技术手册，`docs/本地封面工作台使用教程.md` 为操作说明。
- `.audit/docs-history/` 为只读历史审计，不可代替当前规范；文档文件名保留以兼容已有内链。

## 作品管理工作台硬约束

- **桌面限定**：工作台仅供 Mac 桌面 ≥921px 使用，公开手机版不接入。全屏双栏：左侧视频/时间轴/选帧，右侧作品管理与封面海报；不参与生产构建。细节见 `docs/本地封面工作流.md`。
- **版本兼容**：工作台新增作品/版本写 `auto-projects.json`；原有 14 部的扩展版本写 `legacy-video-variants.json`，不迁移主 MP4；每部最多 8 版。作品共享 3:4 卡片封面，单视频独立海报与 ImageKit。
- **版本排序**：拖动标签自动保存至 `src/data/project-version-order.json`，首个未归档版本为网页默认播放；不更改 `main` 身份及任何媒体或 URL。回归 `npm run check:workbench-version-order`。
- **版本名称**：作品中英文名由 A/B/C 共用；视频版本标签下常显当前版本中英文输入，只有修改后出现保存/撤销，禁止双击/铅笔/第二套重命名。各版本名称沿用 `mainVersionLabel`、`legacy-main-version-labels.json` 和变体数据，本地 `/api/update-version-label` 修改。
- **导航**：工作台上一/下一部按 `project-order.json.all` 跨分类循环，切换前必须经 `navigateWithDraft` 检查草稿，`Option+←/→` 只在非输入状态生效；版本和名称编辑在右侧作品管理区。
- **会话存储**：`.cover-studio/source-objects/` 通过 SHA-256/只读硬链接为 `sessions/<UUID>/source.mp4` 去重，正式 MP4 仍是独立副本。严禁清除 `sessions/`、`exports/`、`project-revisions/`；清理前先 `covers:storage:scan` 与 `covers:storage:verify`，恢复独立视频用 `covers:storage:restore -- <UUID>`。
- **封面与备份**：作品 3:4 封面与每版原比例海报独立管理，备份历史各最多 3 份且支持恢复；比例与版本必须校验，禁止清理 `.cover-studio/project-revisions/`。回归 `check:workbench-history`。
- **精确选帧**：不用 12 张均匀候选图；首/前/后/尾帧按 FPS 精确定位，停止后约 260ms 调 FFmpeg，末帧按真实画面解码而非容器时长。回归 `check:workbench-fast-jog`、`check:workbench-endframe`。
- **ImageKit 和发布边界**：新建作品和已有作品均展示固定前缀 `https://ik.imagekit.io/Ailuren/tr:orig-true/videos/`，可编辑文件名，允许粘贴完整链接自动提取。必须显式保存，失焦不自动提交；本地更新 ≠ 上传 ImageKit ≠ Git 提交 ≠ Netlify 部署。云端 URL 不跟随本地标题改名变化。
- **草稿保护**：修改作品名、视频名、ImageKit、版本或封面后，切换/关闭必须提示未保存；不要重写全局 busy 禁用逻辑。`/api/preview-events` 只用于本机 Vite 局部刷新。回归 `check:workbench-draft-focus`、`check:workbench-preview-sync`。
- **任务区**：右侧仅「作品管理／封面与海报」：作品共享名→视频版本→ImageKit→精选→整部归档；不得恢复「全部作品」Tab、第二套排序保存或重复版本入口。
- **安全归档**：版本标签行右侧 39px 图标只归档当前视频（含 `main`），且至少保留一个可用版本；底部「整部移入回收站」归档非精选作品、必须输入「归档」，精选先退出。`archive-state.json` 与 `.cover-studio/project-revisions/archive-*.json` 保留恢复依据，绝不删除 MP4、WebP 或 ImageKit。回归 `npm run check:workbench-recycle`。
- **封面底色**：作品库、详情、历史、新建和拖拽预览媒体背景统一纯黑 `#000`，`object-fit: contain`，不拉伸。回归 `npm run check:workbench-backdrops`。
- **新建作品**：导入前只显示 MP4 入口、默认素材目录、作品统一名称／分类与可选 ImageKit；导入后 `/api/frame` 自动生成两张独立封面，失败可手动选帧。无效控件在导入前隐藏；底部提示缺失项，不用假「1/3」进度，不自动上传。回归 `npm run check:workbench-create`。
- **界面常显**：工作台不使用 `<details>/<summary>` 隐藏素材目录、ImageKit、版本名、逐帧与封面微调。控件 SVG 居中，媒体纯黑不拉伸；保持 `style.css` → `workbench-enhancements.css` 顺序并验证三档断点。
- **工作台运行约束**：改服务代码先保存草稿、重启当前 5190 服务再 `check:workbench-live`；禁止为测试另启指向正式 `.cover-studio/` 的实例（可能整理历史）。写入测试只能用隔离副本。
- **工作台测试**：写入测试使用隔离项目并拦截 ImageKit；主要回归 `check:workbench-full-flow`、`check:workbench-ux`、`check:workbench-phase3`、`check:workbench-icon-alignment`，检查常见桌面断点。
