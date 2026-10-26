# AI 实验室与站外链接维护

本手册说明首页 AI 实验室三个项目的证据图片、轻量详情及手机站外跳转。视觉真值以 [设计规范](./设计规范.md) 和运行代码为准，不把技术 README、历史方案或旧截图当成当前界面。

## 入口与责任文件

| 职责 | 当前位置 |
| --- | --- |
| 三个项目名称、短说明、GitHub URL、图片列表、在线体验地址及站内详情 | `src/components/ExperimentFlip.jsx` |
| 一屏式布局、媒体框/缩略图、圆角与断点 | `src/components/ExperimentFlip.css` |
| 底部社交 Dock 及 Hover 提示 | `src/components/FloatingDock.jsx`、`FloatingDock.css` |
| 触屏确认面板与站外行为 | `src/components/ExternalLinkSheet.jsx`、`ExternalLinkSheet.css` |
| 所有详情共用顶部导航 | `src/components/CinemaNavigation.jsx`、`src/styles/navigation.css` |
| 项目本地证明图片 | `assets/images/lab/news/`、`illustrations/`、`comparison/` |
| 中文/英文与全站文案 | `src/i18n/dictionary.js` 及项目组件内的双语数据 |

当前项目及证据：

- **AI 新闻追踪**：`assets/images/lab/news/{juya-card,aihot-card,builders-card}.webp`，来自 `Ai-luren/Ainews-to-Feishu`。详情仅保留三张真实飞书卡片，固定同高媒体框及三个圆角缩略图。
- **AI 文章配图**：`assets/images/lab/illustrations/01-two-breakpoints.webp`、`02-sort-by-purpose.webp`、`05-information-well.webp`、`08-trust-bridge.webp`，来自 `Ai-luren/Ailuren-illustrations` 的实例图库。保持原作品比例，四张图片可切换。
- **图片对比工具**：`assets/images/lab/comparison/live-showcase.png`，从该工具真实运行界面的按钮、输入图和滑块区域组合成 **960×700** 展示图；采用**示例输入**，不是直接截图的完整浏览器页面。仅一张展示图、不显示 `1 / 1` 或图片缩略图；「在线体验」和「GitHub 源码」是不同入口，源仓库为 `Ai-luren/Image-comparison`。

这些展示资产由 Vite 本地打包，不以 GitHub Raw 地址作为访客图片来源。用户所在网络无法打开 GitHub 时，仍可先在站内了解项目。完整源码和安装步骤保持在各自仓库 README 中，不重复堆进作品详情。

## 交互与响应式契约

- 「查看项目」始终打开站内详情，不自动离站；所有项目共用同一个详情查看器，顶部继续使用 `CinemaNavigation`，不要创建第二套导航。桌面左图右文，手机上文下图，外层卡片在导航下的剩余视口**垂直居中**、三个项目等高。媒体画面按实际纵横比完整展示，不拉伸。
- 依项目完整图片解码后再打开详情、换图或切换项目，保留请求序号取消过期的异步操作；图片无法解码时应遵循已有兜底。左右箭头和键盘方向键循环三个项目、Escape 关闭并恢复焦点。
- 新闻追踪的主图框固定规格，**三个缩略图按钮和图片内容不得超出各自的圆角边框**。单图工具不渲染缩略图、不显示 `1 / 1`。三个项目的 `1 / 3` 等计数是项目间分页，不是图片分页。
- GitHub 在部分网络环境可能加载失败。粗指针触屏点击 AI 实验室「源码」及底部 Dock 的 GitHub、抖音、小红书、飞书，先显示 `ExternalLinkSheet`（域名、取消、继续访问；GitHub 可复制），确认才在新标签打开；桌面精细指针直接访问并保留 Hover/Focus 提示。底部邮箱复制、微信二维码不额外弹站外面板。源项目详情与二级确认同时存在时，Escape **只关闭最上层**。
- 手机首屏不得为了固定大图高度产生大片黑色空框、横向溢出或把页脚分页挤到屏幕外；设计断点以 CSS/回归脚本为准，不用设备年代推断是否值得适配。英文文案与中文同样要回归。

## 保留原始证据和更新图片

更新项目图片前先核对仓库 README、原始素材和商业/竞赛归属。不得生成虚假的“真实产品截图”；需要说明性质的图片应在标题里标注“示例”“概念”或“组合预览”。

`assets/images/lab/news/workflow.svg`、`assets/images/lab/comparison/hero.svg`、`live-interface.png`、`live-comparison.png` 目前不是网站展示入口引用的资源，而是本地留存的仓库/组合预览参考材料。**不要在未核对引用及取得确认时清理它们**；也不要把临时采集脚本或临时浏览器截图加入 Git。

## 维护流程和验证

1. 修改 `ExperimentFlip.jsx` 中项目元数据与导入资源；真实外部地址需确认可访问，不要把仓库主页当成在线工具 URL。
2. 使用 CSS 现有 Token 优化媒体框，而非给组件添加新玻璃设计系统。改动单图/多图数量时同步修改测试期望。
3. 在本地 `http://127.0.0.1:5174/` 检查 320×568、390×844、744、1024、1440px，分别切换三个项目、缩略图、手机站外确认与语言。
4. 运行以下检查（自动化均使用 `scripts/lib/safe-media.mjs`，禁止真实请求 ImageKit）：

```bash
npm run build
npm run check:lab-showcase
npm run check:external-links
npm run check:nav-modal-breakpoints
npm run check:i18n
npm run check:responsive
npm run check:media-safety
git diff --check
```

以上是**本地当前实现**；GitHub、Netlify 或其他线上平台是否更新，以相应部署记录为准。
