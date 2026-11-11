# 项目协作规则

## 目标

维护可部署到 GitHub Pages、Cloudflare Pages、Vercel 和 Netlify 的 Vite 作品集，包含首页与独立作品库，保证桌面与移动端可访问、构建稳定。

## 结构

- `index.html`：页面结构、文案、全局样式、动画和媒体背景。
- `src/App.jsx`：React 入口，只挂载交互组件。
- `src/components/`：作品档案、影响力模块及其样式。
- `src/data/projects.js`：原始 14 件作品 + `src/data/auto-projects.json` 自动新增条目的汇总入口；`PROJECTS` 经 `project-order.json` 控制「全部作品」显示顺序，`FEATURED_PROJECT_IDS` 通过同一文件单独控制首页八件精选及播放器顺序。无真实资料时保留空值。
- `src/data/auto-projects.json`：工作台新增作品与扩展版本的数据源；旧作品扩展版本另存 `src/data/legacy-video-variants.json`，旧主版本 URL 在 `legacy-imagekit-urls.json`。`src/data/archive-state.json` 仅标记被归档的作品或扩展版本；不要为清理列表而删除素材。上线前需配置可访问的视频地址。
- `assets/videos/works/`：本地原始作品视频，Vite 开发模式下始终优先使用这些本地文件（不请求 ImageKit）；Git 忽略且不进入正式构建。分类按商业广告、创意短片、海外产品广告、视觉实验管理。
- `works.html`、`src/works-main.jsx`：独立作品库的 Vite 多入口页面；站内链接使用相对路径，保持 GitHub Pages 子路径兼容。
- `assets/`、`vendor/`：图标、视频和第三方静态资源；页面使用系统字体栈，不依赖远程字体 CDN。
- `docs/`：`设计规范.md` 是唯一持续生效的视觉与交互规范；维护指南为操作说明，带日期的审计/验收文档只作历史记录。
- `tools/cover-studio/`：本地作品工作台，使用 FFmpeg、环回端口和可恢复的归档索引维护作品；不接入正式 Vite 构建或部署。
- `.cover-studio/`：本地导入副本、候选帧、封面替换与改名历史、迁移前媒体备份；被 Git 忽略，不能当缓存清空。
- 作品 3:4 封面位于 `assets/images/project-covers/<category>/<English Title>.webp`，播放器原比例海报位于 `assets/images/player-posters/<category>/<MP4 English Stem>.webp`；`category` 仅为 commercial、short-film、social、visual。英文标题修改须同步本地 MP4、封面、海报和 JSON 映射，旧图留存本地历史。命名及历史回滚见 `docs/作品库维护.md`。

## 规则

- 优先复用现有字体、颜色、间距和玻璃面板，不引入无必要的视觉体系。
- 修改 CSS 前先确认规则归属：Hero、共享 Token、导航、玻璃和作品库拥有各自文件；禁止复制旧版调参器或无必要地在 `index.html`、共享 CSS 中叠加同选择器覆盖。
- 首页滚动使用浏览器原生初始定位及历史恢复；**禁止主动强制归零**，尤其不能在 `load`／`pageshow` 中重置访客位置，也不能将 `history.scrollRestoration` 改为 `manual`。生产构建后运行 `npm run check:home-scroll`，覆盖弱网、返回及 `#projects` 深链。
- 导航响应式契约：**761px 及以上首页与全部作品页都展开同一套四项文字导航**；760px 及以下才使用汉堡菜单。作品库普通页左侧 A+ 箭头 +「首页 / Home」在双端都指向首页 Hero (./index.html)，不要误改成 #projects 或创作者头像；作品详情/获奖/账号资料弹窗仍使用共享头像品牌导航。保留 B+++ 语言切换和 = → × 动画，不为平板单独创建导航实现。
- 获奖画廊一次显示全部 8 张，≥1280px 八列，≤1279px 四列两排；手机卡片只显示完整图片，标题和奖项信息在图片查看器中呈现。画廊不使用左右切换，查看器保留原有导航和焦点恢复。
- AI 实验室详情保持三项目共享导航、一屏等高、真实素材与 `check:lab-showcase`；手机站外链接共用 `ExternalLinkSheet`，禁止伪造界面/绕过确认，入口和素材维护见 `docs/AI实验室与外链维护.md`。
- 打开手机菜单时，焦点必须进入模态菜单，Tab/Shift+Tab 不得离开菜单内容；关闭后恢复正常焦点和页面滚动。从 ≤760px 调整到 ≥761px 时应立即关闭已打开或正在关闭的菜单、恢复 inert/滚动锁并让文字导航可操作。执行 `npm run check:nav-modal-breakpoints`。
- 获奖素材「海螺AI动物跳水.webp」原图右侧有约 2–3px 明亮接缝；只能在对应获奖图片查看器中按比例裁切，保持其他获奖图、查看器圆角、媒体尺寸不变。素材更新后重新检查，执行 `npm run check:award-edge`。
- 三类共享查看器（作品播放器、获奖荣誉、AI 自媒体资料）共用缓动曲线：进入 260ms、退出 220ms、内容轻微位移 8px；保持背景模糊层独立且固定，不对子容器以外的导航胶囊使用 transform。关闭时播放器立即停止媒体，退出后才解除模态、恢复滚动和焦点；减少动态效果时不等待。运行 `npm run check:modal-motion`。
- 保持 GitHub Pages 相对路径构建方式，不修改部署配置或环境变量。
- 不提交简历、提示词、过程记录、临时预览页或过期设计方案。
- 页面内容和视觉调整完成后，必须执行构建验证。
- 修改文案、字号、行宽、容器宽度等影响排版的内容后，必须执行双语布局检测。
- 双语文案应保持自然且语义一致，避免单词间双空格；导航标签保持紧凑，作品英文标题可换行，不能为凑字数强行缩写品牌或片名。
- 首页精选与完整作品顺序分别由 `src/data/project-order.json` 的 `featured`（固定 8 件、成员可替换）和 `all` 维护。工作台拖动封面松手自动保存、可撤销，星标须明确选择替换对象；不要使用 `PROJECTS.slice(0, 8)` 或锁定全部作品前 8 项。优先检查本地预览自动同步，必要时再刷新 `5174`；回归 `check:curated-order`、`check:work-cards`。
- 删除资源前先确认它没有被页面、组件或构建配置引用。
- 修改英文标题时必须原子更新本地 MP4、两类封面与映射；**ImageKit URL 不跟随更名**。回归 `check:asset-catalog`，海外产品还需 `check:overseas-names`。
- 卡片 3:4 封面与各视频版本原比例海报必须独立保存、校验比例并备份旧图，禁止改动无关版本。回归 `check:cover-poster`；禁用未适配四分类目录的旧 `generate-player-media.mjs`。
- 在本机 Vite 开发模式下，`src/data/projects.js` 的作品播放器使用 `assets/videos/works/` 中的本地 MP4；即使已配置 ImageKit URL 也不能走线上 CDN。没有本地原片时不要自动回退访问 ImageKit。正式构建仍保持 ImageKit 原始视频链接。
- **零 ImageKit CDN 消耗是自动化测试的硬性约束**：日常测试、截图、UI 检查、回归测试禁止向 ImageKit 发起真实网络请求；不要为了测试布局访问线上作品视频。
- 所有使用 Playwright 的脚本必须通过 `scripts/lib/safe-media.mjs` 的 `createSafePage` / `createSafeContext` 创建受保护的页面或上下文；这些辅助函数在导航和播放前拦截 ImageKit 请求，MP4 由 `scripts/fixtures/` 本地小视频替代，其他 ImageKit 请求直接阻断。新测试也必须遵守。不能调用 `route.continue()` 绕过该保护。
- 自动测试使用本地模拟媒体验证播放器状态、尺寸和导航；真实 CDN 播放检查只能在用户**明确授权**后单独手动执行，绝不自动回退到真实视频。不得改动生产环境 `tr:orig-true`、点击后加载及 `preload="none"` 的行为。


## 验证与维护

- **分级验证**：日常 `npm run check:smoke`；工作台 `npm run check:workbench-core`；`npm run check:project` 顺序运行两组。上线前 `npm run check:site-full`、`npm run check:workbench-full` 或 `npm run check:adversarial`。失败不可删除断言；写入测试只在隔离项目执行，浏览器测试须拦截 ImageKit。
- **专项命令**：发布前 `npm run build`；媒体安全 `npm run check:media-safety`；首页弱网滚动 `npm run check:home-scroll`（先 build）；影院真本地 MP4 `npm run check:cinema-local`（需 5174 开发服务）；双语 `npm run check:i18n`；其他按 `docs/交接说明.md` 和对应手册执行，最后 `git diff --check`。
- **运行**：本地启动 `npm run dev` 后访问 `http://127.0.0.1:5174/`；正式预览用 `npm run preview`，不能直接打开 `index.html` 文件。
- `.audit/` 仅本地保存报告和素材对照，不属于部署文件；旧记录见 `.audit/README.md`，不得清空。旧 Git 分支及不可达对象须核实恢复价值后才能清理。

## 文档入口

- `docs/文档索引.md` 为总导航；`README.md` 面向访客，`docs/设计规范.md` 是当前视觉规范，`docs/交接说明.md` 为开发与部署手册。
- `docs/作品库维护.md` 管理作品及排序；`docs/播放器媒体维护.md` 管理视频和影院；`docs/本地封面工作流.md` 为工作台技术手册，`docs/本地封面工作台使用教程.md` 为操作说明。
- `.audit/docs-history/` 为只读历史审计，不可代替当前规范；文档文件名保留以兼容已有内链。

## 作品管理工作台硬约束

- **桌面限定**：`npm run covers` 只供 Mac 桌面（宽度 ≥921px）使用；公开作品集手机版保持原样。详情采用全屏双栏：左侧本地 MP4 播放/时间轴/选帧，右侧两种封面、中英文标题、版本、ImageKit 和精选。工作台不参与生产构建。
- **版本兼容**：新作品版本保存在 `src/data/auto-projects.json`；原有 14 部作品可直接添加 B/C 版本，新增记录保存在 `src/data/legacy-video-variants.json`，**不迁移或覆盖原主视频**。每部最多 8 个版本；卡片封面属于作品，原比例海报与 ImageKit URL 属于所选视频版本。回归 `node scripts/check-cover-studio-legacy-version.mjs`。
- **版本排序**：同一作品的视频版本可按住标签拖动，松手自动保存到 `src/data/project-version-order.json`；首个视频为公开影院默认播放版本，但 `main` 主版本身份、媒体文件、封面、各版本 ImageKit URL 不得改变。回归 `npm run check:workbench-version-order`。
- **版本名称**：整部作品的中英文标题由所有 A/B/C 版本共用；视频版本标签与作品标题独立。右侧「视频版本」任务区单击标签切换，单击铅笔或「重命名当前版本」编辑中英文；不要恢复隐藏的双击入口。新增版本同样位于右侧。名称保存在自动作品 `mainVersionLabel`、`legacy-main-version-labels.json` 或附加版本记录中；仅监听 `127.0.0.1:5190` 的 `/api/update-version-label` 不得连接到生产页面。
- **导航**：顶部上一部/下一部按 `src/data/project-order.json` 的 `all` 顺序跨分类、精选与搜索**首尾循环**；切换前经过 `navigateWithDraft` 草稿保护，`Option + ←/→` 仅在非输入状态使用。视频版本切换/改名统一放右侧「视频版本」任务区，左侧只负责播放、时间轴与选帧。
- **会话存储**：工作台的 `sessions/<UUID>/source.mp4` 同内容视频通过 `.cover-studio/source-objects/` 共享 SHA-256 校验的只读硬链接；正式作品 MP4 始终保持独立可编辑文件。不得自动删除 `project-revisions/`、`sessions/` 选帧或 `exports/`。需清理时先运行 `npm run covers:storage:scan` 与 `npm run covers:storage:verify`；恢复独立会话用 `npm run covers:storage:restore -- <UUID>`。变更须通过 `npm run check:workbench-storage`。
- **封面与备份**：3:4 卡片封面和播放器原比例海报独立保存，不拉伸；保存/恢复前备份当前图。最多保留每部卡片 3 份旧图，以及每个视频版本海报 3 份旧图；按 SHA-256、版本、路径及真实比例校验。严禁把 `.cover-studio/project-revisions/` 当缓存删除。回归 `npm run check:workbench-history`。
- **精确选帧**：不恢复 12 张随机候选帧、额外秒数输入或 FPS 说明。只使用本地播放器时间轴、毫秒时间及四个等高按钮「首帧／上一帧／下一帧／尾帧」，按源视频 fps 逐帧；停止约 260ms 后请求最新高清静帧。末帧须解码真实视频画面而不是音频容器尾部；一个保存动作完成取帧与写入。回归 `npm run check:workbench-fast-jog`、`npm run check:workbench-endframe`。
- **ImageKit 和发布边界**：新建作品和已有作品均展示固定前缀 `https://ik.imagekit.io/Ailuren/tr:orig-true/videos/`，可编辑文件名，允许粘贴完整链接自动提取。必须显式保存，失焦不自动提交；本地更新 ≠ 上传 ImageKit ≠ Git 提交 ≠ Netlify 部署。云端 URL 不跟随本地标题改名变化。
- **草稿与状态**：修改标题、ImageKit、视频版本、封面后关闭/跳转均须保护草稿。工作台原有 busy 状态逻辑不得重新全局禁用/启用作品库、详情和独立对话框按钮。`/api/preview-events` 只面向本机 Vite 预览局部刷新，不得出现在生产连接中。回归 `npm run check:workbench-draft-focus`、`npm run check:workbench-preview-sync`。
- **任务区与草稿**：编辑页右侧只有「视频版本／封面与海报／作品设置」三种任务分区，初始为视频版本；切换任务也必须保护未保存草稿。作品库默认展示 8 部精选，其他四类独立浏览；拖动卡片自动保存可撤销。不得恢复「全部作品」Tab、重复版本入口或第二套排序保存流程。
- **回收站安全**：只能通过 `POST /api/archive-item` 将非精选作品或非主视频版本归档，通过 `POST /api/restore-item` 恢复；整部作品须输入「归档」，精选必须先退出精选。`archive-state.json` 和 `.cover-studio/project-revisions/archive-*.json` 必须保留；归档/恢复不得物理删除 MP4、封面、海报或线上 ImageKit 资源。回归 `npm run check:workbench-recycle`。
- **封面底色**：作品库、详情、历史、新建和拖拽预览媒体背景统一纯黑 `#000`，`object-fit: contain`，不拉伸。回归 `npm run check:workbench-backdrops`。
- **几何与视觉**：导航相对整个编辑器居中，按钮等高不折行；精选星标和加号用对称 SVG，不用字体 ★/☆/+ 代替图标。新增作品优先显示拖入 MP4，默认素材目录位于可展开区域；媒体底图纯黑，图片不拉伸。先加载 `style.css` 再加载 `workbench-enhancements.css`，样式变更执行断点与图标回归。
- **安全测试**：Playwright 只使用 `scripts/lib/safe-media.mjs` 保护的页面，本地小 MP4 夹具和隔离项目；禁止真实 ImageKit CDN 请求，禁止写入正式素材/排序数据。工作台改动至少运行 `npm run check:workbench-full-flow`、`npm run check:workbench-ux`、`npm run check:workbench-phase3`、`npm run check:workbench-icon-alignment`、`npm run build`。窗口覆盖 1440×900、1280×720、1000×750，测试导航偏差、按钮居中、弹窗越界及草稿保护。完整命令见 `docs/本地封面工作台使用教程.md`。
