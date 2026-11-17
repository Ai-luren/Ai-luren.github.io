# 项目协作规则

> 当前站点源码与下面引用的专属文档为权威依据。第一次接手先读 [ARCHITECTURE](ARCHITECTURE.md)，按任务阅读对应文档，不把日期化 .audit 快照当现行规则。

## 项目边界

- 公开作品集是 Vite 双 HTML 入口（index.html + works.html）与 React Portal 共存的静态网站；源码在 src/、assets/，构建产物为 dist/。不得用“整站改写 React”解决局部问题。
- 作品管理工作台在 portfolio-workbench/，用 npm run workbench 启动，仅本机 Mac 桌面端使用；它会写入项目 JSON、封面、海报和本地历史，**不自动上传 ImageKit、提交 Git 或部署站点**。
- 作品数据唯一导出入口是 src/data/projects.js；字段和 12 份 JSON 的优先级、精选/全部顺序、版本真值见 [作品库维护](docs/作品库维护.md)。
- 视觉与 D+ 玻璃的唯一规格见 [设计规范](docs/设计规范.md)；作品管理工作台的独立视觉和写入规范见 [作品管理工作台技术维护](docs/作品管理工作台技术维护.md)，操作说明见 [使用指南](docs/作品管理工作台使用指南.md)。

## 不可突破的安全边界

- **绝不误删用户资料**：assets/videos/works/ 原片、.cover-studio/ 的 sessions/、exports/、source-objects/、project-revisions/、本地未提交作品图和 .audit/ 历史均不得当普通缓存清空。删资源前检查调用方、恢复依据与备份。作品及版本只能走可恢复的归档 API，不能永久物理删除。
- **工作台写入隔离**：具有写入能力的测试只操作隔离项目；不能为了验收另启一个指向正式 .cover-studio/ 的工作台服务。修改现有 5190 服务代码须先保存草稿，再正常重启后运行 check:workbench-live。
- **自动化必须先隔离网络**：Playwright 在 context 导航前使用 scripts/lib/safe-media.mjs 拦截 ImageKit 所有 HTTP(S) 请求（包括缩略图、视频转码和带查询参数的媒体），不能只按 .mp4 后缀或 resourceType=media 过滤。Media Library/统计页面也可能请求收费缩略图，禁止自动批量进入。
- **第三方资源同样有成本**：Netlify 正式站/Preview 和其它平台 Hero 视频下载均可能产生额度或流量压力。批量测试使用本地 Vite/媒体夹具，不通过循环刷新在线预览验收。真实线上单条媒体检查须先说明成本、获得明确批准并限定次数。
- **Git/发布需明确授权**：本地 Commit 不等于 Push；合并 main 可触发 GitHub Pages、Cloudflare Pages、Vercel、Netlify 自动发布。未经用户明确要求，不动域名、平台付费套餐或 main。
- **对外证据真实**：不提交简历、客户保密原片、提示词或本地草稿；公开 README 仅引用真实已存在的作品图。测试 Demo 不得冒称品牌正式委托，奖项必须有来源证据。

## 当前产品不可破坏的契约

- **Hero 与首帧**：桌面视频按滚动 seek；≤760px 手机用 13.83s C 版正向光学溶接循环，?heroMode=scrub 使用旧滚动片。Cloudflare *.pages.dev 的 seek 源使用 GitHub Pages 同 hash MP4 以支持 206；改 Hero hash 前必须先考虑镜像可用性。详见 [播放器媒体维护](docs/播放器媒体维护.md)。
- **静态 HTML + React**：保留首页原始电影穿行间隔和 Portal :empty 首帧高度，防止深链/刷新时 CLS、Hero 闪烁与黑边；不恢复退役 WebGL、CRT 扫描线或全局遮罩。
- **作品身份和导航**：精选为 project-order.json.featured 中 8 件独立名单，all 顺序独立；移动端连续 2×4 展示而不是分页。浏览器 history.scrollRestoration=auto；不通过 load/pageshow 强制回顶。作品库 ?watch=ID 打开海报而非自动播放，?project=ID 仅工作台高亮。
- **视频媒体**：3:4 作品卡封面与每条视频原比例海报分开保存；版本 main 表示身份，不保证默认排第一。影片 MP4 按点击才加载（正式 ImageKit tr:orig-true、preload=none）。本地更名需原子更新本地 MP4、两类图及 JSON，不能改变已上传 ImageKit URL。
- **用户界面**：两页导航断点、焦点与语言切换、作品目录、影院动作、D+ Glass、动效数值以 [设计规范](docs/设计规范.md) 和 [播放器媒体维护](docs/播放器媒体维护.md) 为准；不得靠在 CSS 末尾叠加 !important 补丁解决旧规则。
- **作品管理工作台**：>=921px Mac 桌面；左侧本地视频/逐帧/选帧，右侧「作品管理」及「封面与海报」；更名、版本、排序、归档须有期待旧值校验、草稿保护、修订历史。版本归档至少留一条可用视频；精选作品先退出精选才能整部归档。

## 验证与维护

- npm run build + git diff --check 为基线；npm run check:plan 只读；npm run check:project 为网站与工作台 26 入口快速回归；发布前按改动范围运行 check:site-full / check:workbench-full。唯一队列在 scripts/lib/check-suite-catalog.mjs，不能删除独有断言凑通过率。
- 网站视觉与响应式改动须覆盖中英文、手机和桌面；测试差异先区分真实回归、测试过期与异步时序。真值和专项入口见 [测试与回归维护](docs/测试与回归维护.md)。
- 不因“没有直接 import”就清理旧文件；先按 [历史代码待清理清单](docs/历史代码待清理清单.md) 查引用、运行时入口和恢复历史。
