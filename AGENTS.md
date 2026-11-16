# 项目协作规则

## 目标

维护可部署到 GitHub Pages、Cloudflare Pages、Vercel 和 Netlify 的 Vite 作品集，包含首页与独立作品库，保证桌面与移动端可访问、构建稳定。

## 结构

- `index.html`：页面结构、文案、全局样式、动画和媒体背景。
- `src/App.jsx`：React 入口，只挂载交互组件。
- `src/components/`：作品档案、影响力模块及其样式。
- `src/data/projects.js`：汇总原始 14 部作品与 `auto-projects.json`；`project-order.json` 的 `all` 控制完整顺序、`featured` 控制独立的 8 部首页精选。无证据的奖项字段保持空值。
- `src/data/auto-projects.json`：新增作品和扩展版本；旧作品附加版本及原主视频 URL 分别见 `legacy-video-variants.json`、`legacy-imagekit-urls.json`。`archive-state.json` 可归档整部作品或任何版本（含 `main`），禁止物理删除素材。
- `assets/videos/works/`：本地原始作品视频，Vite 开发模式优先用本地 MP4，缺片也禁止回退 ImageKit；Git 忽略且不进正式构建，正式网站使用配置的云端链接。分类为商业广告、创意短片、海外产品广告、视觉实验。
- `works.html`、`src/works-main.jsx`：独立作品库的 Vite 多入口页面；站内链接使用相对路径，保持 GitHub Pages 子路径兼容。
- `assets/`、`vendor/`：图标、视频和第三方静态资源；页面使用系统字体栈，不依赖远程字体 CDN。
- `docs/`：`设计规范.md` 是公开网页的唯一视觉与交互规范；工作台专属规则见 `docs/本地封面工作流.md`，维护指南为操作说明，带日期的审计/验收文档只作历史记录。
- `portfolio-workbench/`：本地作品工作台，使用 FFmpeg、环回端口和可恢复的归档索引维护作品；不接入正式 Vite 构建或部署。
- `scripts/checks/site/` 与 `scripts/checks/workbench/`：分别存放网页和工作台回归测试；共用 `scripts/lib/safe-media.mjs` 与 `scripts/fixtures/`，正式构建不包含这些测试。移动脚本须同步 `package.json`、`run-adversarial-checks.mjs` 与相对导入，并执行 `npm run check:repo-layout`。
- `.cover-studio/`：本地导入副本、候选帧、封面替换与改名历史、迁移前媒体备份；被 Git 忽略，不能当缓存清空。
- 正式 3:4 封面与原比例海报分别位于 `assets/images/project-covers/<category>/`、`assets/images/player-posters/<category>/`，按英文名或视频文件 stem 命名；分类为 commercial / short-film / social / visual。改英文名须原子同步 MP4、图片与 JSON 映射、保留历史，不改 ImageKit URL。

## 规则

- 优先复用现有字体、颜色、间距和玻璃面板，不引入无必要的视觉体系。D+ 玻璃语义 Token 以 `src/styles/card-surfaces.css` 和 `docs/设计规范.md` 为唯一依据：阅读卡、Hero 按钮、导航与播放器控件共享色调及边缘，但按内容密度分别保护文字；禁止将所有面板强制改成同一透明度或叠加第二层模糊。
- 修改 CSS 前先确认规则归属：Hero、共享 Token、导航、玻璃和作品库拥有各自文件；禁止复制旧版调参器或无必要地在 `index.html`、共享 CSS 中叠加同选择器覆盖。
- **跨页首帧稳定**：`index.html` 静态 HTML 必须保留 after-top、after-projects、outro 三段电影穿行间隔，`heroImmersivePreview.js` 不得二次插入；三个 React 门户的 `:empty` 高度只负责首次挂载前的锚点空间。修改后检查桌面／手机从 Works 深链返回时的布局位移，不得用黑屏 Loading 掩盖。
- **手机 Hero 与封面**：≤760px 默认 30s ping-pong 静音背景，`?heroMode=scrub` 保留原 15s 滚动定位对照；桌面继续滚动驱动，所有作品播放器视频必须主动点击后才加载。精选首行即请求封面，其余靠 1100px 观察器挂载 `src` 后使用 `loading="eager"`，不能再叠加原生 lazy 导致空白。回归见 `docs/播放器媒体维护.md`。
- 首页滚动使用浏览器原生初始定位及历史恢复；**禁止主动强制归零**，尤其不能在 `load`／`pageshow` 中重置访客位置，也不能将 `history.scrollRestoration` 改为 `manual`。首次生产加载时 ScrollTrigger 刷新不得导致「专业实力」导航滚动提前结束；只允许一次受限恢复，用户主动滚动必须解除锁定。生产构建后检查 `check:home-scroll`、`check:nav-scroll` 与 `scripts/checks/site/check-desktop-primary-navigation.mjs`。
- 导航响应式契约：**761px 及以上首页与全部作品页都展开同一套四项文字导航**；760px 及以下才使用汉堡菜单。作品库左侧「首页 / Home」明确指向 `./index.html#top` 的 Hero；浏览器 Back 保持历史位置，「精选作品」导航另走 `#projects`；作品详情/获奖/账号资料弹窗仍使用共享头像品牌导航。保留 B+++ 语言切换和 = → × 动画，不为平板单独创建导航实现。
- **单作品链接与工作台隔离**：`works.html?watch=ID` 在作品库打开海报详情但不自动播放，使用浏览器历史返回/前进关闭和重开；`works.html?project=ID` 仅供工作台定位并高亮卡片，不自动播放。关闭恢复原卡片位置和焦点；首页精选不更改主页 URL。播放器及目录**均不显示复制作品链接 UI**，但 `?watch` 直达 URL、浏览器历史前进／后退与自动生成的站内链接仍正常。回归 `check:shareable-works`、`check:cross-page-nav`、`check:cinema-work-directory`。
- **播放器作品目录**：现行「作品目录」入口位于标题下方分类信息的右侧、原复制链接的位置，使用 `--apple-secondary` 同级的透明文字 Ghost 操作；**底部只保留一组居中上一部／计数／下一部箭头，不允许再增加第二个目录按钮**。目录在播放器已有 `dialog` 内展开：**≥1320px 且高度≥601px** 右侧非模态栏，按需打开并保持，关闭只能由 X/Escape/播放器关闭，允许同时操作影片、上一部／下一部和 A/B/C；画面横向中心不能因打开目录移动，必要时按比例缩小。较窄/较矮窗口使用临时覆盖，≤760px 手机底部面板选片后关闭。筛选为「全部／精选」与四分类 2×2，6 个入口不得被裁切。独立视频版本 A/B/C 仍用既有细下划线 Tab；**彻底移除复制链接按钮**。共用全站 `card-surfaces.css` Token，无第二个 modal、蓝光或新增配色；跨分类切片先解码海报不下载视频、更新原 `?watch` 条目不增加历史。回归 `npm run check:cinema-work-directory`、`npm run check:shareable-works`。
- 获奖画廊一次显示全部 8 张，≥1280px 八列，≤1279px 四列两排；手机卡片只显示完整图片，标题和奖项信息在图片查看器中呈现。画廊不使用左右切换，查看器保留原有导航和焦点恢复。
- AI 实验室详情保持三项目共享导航、一屏等高、真实素材与 `check:lab-showcase`；手机站外链接共用 `ExternalLinkSheet`，禁止伪造界面/绕过确认，入口和素材维护见 `docs/AI实验室与外链维护.md`。
- 打开手机菜单时，焦点必须进入模态菜单，Tab/Shift+Tab 不得离开菜单内容；关闭后恢复正常焦点和页面滚动。从 ≤760px 调整到 ≥761px 时应立即关闭已打开或正在关闭的菜单、恢复 inert/滚动锁并让文字导航可操作。执行 `npm run check:nav-modal-breakpoints`。
- **首页 / Works 手机菜单同源**：均为四项导航＋四个社媒文字链接，无版权行，触控区 ≥44px，Logo/语言/关闭胶囊一致。首页用静态抽屉、Works 用原生 dialog，但视觉 Token 共享；链接从 `src/navigation/socialProfiles.js` 读取，UI 在 `MobileMenuSocialLinks.jsx`，CSS 在 `navigation.css`。关闭需释放锁滚动与焦点；回归 `check:shared-mobile-menu`、`check:design-system` 和 `check:glass-material`。
- 获奖素材「海螺AI动物跳水.webp」原图右侧有约 2–3px 明亮接缝；只能在对应获奖图片查看器中按比例裁切，保持其他获奖图、查看器圆角、媒体尺寸不变。素材更新后重新检查，执行 `npm run check:award-edge`。
- 三类共享查看器（作品播放器、获奖荣誉、AI 自媒体资料）共用缓动曲线：进入 260ms、退出 220ms、内容轻微位移 8px；保持背景模糊层独立且固定，不对子容器以外的导航胶囊使用 transform。关闭时播放器立即停止媒体，退出后才解除模态、恢复滚动和焦点；减少动态效果时不等待。运行 `npm run check:modal-motion`。
- 保持 GitHub Pages 相对路径构建方式，不修改部署配置或环境变量。
- 不提交简历、提示词、过程记录、临时预览页或过期设计方案；公开 README 使用真实、已存在的作品图和证明，创意测试或独立 Demo 必须明确标注，不得冒充正式委托。
- 页面内容和视觉调整完成后，必须执行构建验证。
- 修改文案、字号、行宽、容器宽度等影响排版的内容后，必须执行双语布局检测。
- 双语文案应保持自然且语义一致，避免单词间双空格；导航标签保持紧凑，作品英文标题可换行，不能为凑字数强行缩写品牌或片名。
- 首页精选固定 8 件且可换成员，与 `project-order.json` 的 `all` 独立；卡片拖拽自动保存/可撤销，不能锁定全部作品前八件或用 `PROJECTS.slice(0,8)`。回归 `check:curated-order`、`check:work-cards`。
- 删除资源前先确认它没有被页面、组件或构建配置引用。
- 修改英文标题时必须原子更新本地 MP4、两类封面与映射；**ImageKit URL 不跟随更名**。回归 `check:asset-catalog`，海外产品还需 `check:overseas-names`。
- 卡片 3:4 封面与各视频版本原比例海报必须独立保存、校验比例并备份旧图，禁止改动无关版本。回归 `check:cover-poster`；禁用并归档未适配四分类目录的旧 `generate-player-media.mjs`（可从 Git 历史恢复）。
- **自动化零 CDN 请求**：所有浏览器测试、截图与回归均不得访问真实 ImageKit；只用本地夹具与模拟数据，除非用户明确批准单独手动核实。
- **Playwright 防护**：必须使用 `scripts/lib/safe-media.mjs` 中的 `createSafePage` 或 `createSafeContext`，阻断 ImageKit、替换云端 MP4，禁止 `route.continue()` 绕过防护。
- 云端播放前缀 `tr:orig-true`、按点击才加载、`preload="none"` 均为生产媒体约束；不可因离线回归改变。


## 验证与维护

- **验证分级**：只读清单 `npm run check:plan`；快速网站 `npm run check:smoke`、工作台 `npm run check:workbench-core`，合计 `npm run check:project`。发布前深测 `npm run check:site-full`、`npm run check:workbench-full` 或 `npm run check:adversarial`。唯一队列见 `scripts/lib/check-suite-catalog.mjs`，说明见 `docs/测试与回归维护.md`。仅保留当前有效且有独立价值的测试；删除重复/过期测试前须将独有断言并入现行测试、核实调用方，更新清单并复跑。
- **专项检查**：改代码先 `npm run build`；媒体安全 `npm run check:media-safety`；弱网滚动 `npm run check:home-scroll`（先构建）；本地缓冲 `npm run check:cinema-local`（需 5174 开发服务）、手机播放器 `npm run check:cinema-controls`（默认 5174，支持 `PORTFOLIO_URL`）；中英排版 `npm run check:i18n`；结束 `git diff --check`。
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
- **服务端真实验收**：修改 `portfolio-workbench/` 后先检查 5190 是否为旧进程、确认无未保存草稿，再正常重启 `npm run workbench` 并执行 `npm run check:workbench-live`。服务启动可能修剪超过限额的封面历史，**禁止为了测试而启动第二个实例指向正式 `.cover-studio/`**；写入型测试必须使用隔离项目。构建/隔离测试不能替代正式服务验收。
- **安全测试**：Playwright 使用 `safe-media.mjs`，写入型案例只运行在隔离项目，不得操作正式排序/视频/封面。工作台改动至少验证 `check:workbench-full-flow`、`check:workbench-ux`、`check:workbench-phase3`、`check:workbench-icon-alignment` 与构建；覆盖 1440×900/1280×720/1000×750。
