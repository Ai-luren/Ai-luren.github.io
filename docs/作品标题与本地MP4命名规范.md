# 作品标题与本地 MP4 命名规范

当前本地共有 **17 部作品、18 条 MP4（含版本 A/B）**。标题用于首页精选、分类作品库、播放器及工作台；分类 Tab 已包含「AI」和作品类型，因此除确属品牌正式名称的用词外，作品标题不再重复强调 AI。保留必要的品牌、核心主体和差异化用途。中文采用「品牌／主体＋作品类型」或原创作品名；英文采用符合创意作品集习惯的 Title Case，不逐字硬译。

| ID | 分类 | 中文最终标题 | 英文最终标题 |
| --- | --- | --- | --- |
| 01 | 商业广告 | 屈臣氏品牌广告 | Watsons Brand Commercial |
| 02 | 商业广告 | 联想品牌广告 | Lenovo Brand Commercial |
| 03 | 商业广告 | 通义万相 2.2 宣传片 | Wan2.2 Promotional Film |
| 04 | 商业广告 | 霸王茶姬品牌广告 | CHAGEE Brand Commercial |
| 05 | 创意短片 | 猫咪的一天 | A Day in a Cat's Life |
| 06 | 商业广告 | 岳阳楼文旅宣传片 | Yueyang Tower Tourism Film |
| 07 | 创意短片 | 人、河流与城市 | People, Rivers and Cities |
| 08 | 创意短片 | 光 | Light |
| 09 | 商业广告 | 无线耳机场景广告 | Wireless Earbuds Lifestyle Ad |
| 10 | 海外产品广告 | 无线耳机产品展示 | Wireless Earbuds Product Showcase |
| 11 | 海外产品广告 | 无线耳机搞笑广告 | Wireless Earbuds Comedy Ad |
| 12 | 海外产品广告 | 车载坐垫体验广告 | Car Seat Cushion Demo |
| 13 | 海外产品广告 | 宠物红光护理仪广告 | Pet Red Light Therapy Ad |
| 14 | 视觉实验 | 国风巨物美学 | Monumental Chinese Visuals |
| 15 | 视觉实验 | 最难的告别 | The Hardest Goodbye |
| 16 | 商业广告 | MEXC 会员权益 | MEXC Member Perks |
| 17 | 商业广告 | MEXC 不用等了 | MEXC No More Waiting |

## 文件名与播放地址边界

- **作品标题**：`src/data/project-title-overrides.json`；原有记录也保存在 `projects.js`，但以标题覆盖配置为最终展示数据源。自动新增作品的原始标题在 `auto-projects.json`。
- **本地 MP4**：`assets/videos/works/<分类目录>/<英文标题>.mp4`。作品 16 为 `MEXC Member Perks - Version A.mp4` 和 `MEXC Member Perks - Version B.mp4`。文件名根据作品英文名更新；原有 01–15 号实际路径保存在 `src/data/local-video-paths.json`，建站时据此查找文件，原始旧路径由 `local-video-origins.json` 记录。自动新增的 16 号以后直接使用 `auto-projects.json` 的 `localVideoPath` 和各视频版本路径。
- **工作台双击英文标题**：工作台调用 `/api/update-title`，同步保存标题、重命名**作品库内的 MP4、3:4 封面及播放器海报**、更新所有路径索引、记录历史，失败时回滚。单独修改中文不会强行更改当前英文文件名。
- **不改动**：`https://ik.imagekit.io/Ailuren/...` 线上地址、源视频内容、`/Users/ailuren/Desktop/重要资料/个人网页作品集-imagekit本地` 中的待上传或原始 MP4、奖项、作品 ID、排序。
- **恢复信息**：`.cover-studio/project-revisions/title-style-20261107-backup.json` 和每个作品的 `title-<ID>-<UUID>.json` 留存改名前后文件名及数据备份。禁止仅凭中文显示标题去拼接视频路径或覆盖旧源片。

## 空格、大小写与风格

- **中文**：汉字词组之间不随意加空格，如「无线耳机搞笑广告」，而非「无线耳机 搞笑广告」；英文品牌与中文之间保留一个半角空格（如「MEXC 会员权益」），中文品牌与版本号之间也保留一个空格（如「通义万相 2.2 宣传片」）。
- **英文**：统一使用 Title Case（主要单词首字母大写），但品牌注册样式优先（CHAGEE、MEXC、Wan2.2）；完整标题内部使用单个半角空格，避免中英混杂的点号与冗余 AI。
- **含义**：英文优先表达真实视频内容，而不是逐字翻译或仅标注拍摄方式。喜剧创意为 Comedy Ad，产品体验演示为 Demo，原创叙事保留片名，品牌商业片保留 Brand Commercial。
- **文件**：主视频以英文标题作为本地 MP4 文件名；多版本在标题后用 - Version A、- Version B。在线 CDN URL 不随标题变更；使用中的卡片封面及播放器海报会同步更名，旧图保留本地备份。

## 正式图片目录命名规则

- 作品卡片封面：assets/images/project-covers/<category>/<English Title>.webp（3:4）。
- 播放器原比例海报：assets/images/player-posters/<category>/<MP4 English Stem>.webp（保留实际播放比例）。
- category 仅使用 commercial、short-film、social、visual，与作品 Tab 对应；A/B 版本保持和 MP4 一致的 Version A / Version B 后缀。
- 工作台替换封面时保持正式文件路径不变，先将上一版备份至 .cover-studio/project-revisions/cover-history/<ID>/。修改英文标题时才同步更名 MP4、封面、海报并更新引用。
- 迁移前的旧图片和数据快照归档于 `.cover-studio/project-revisions/media-catalog-20261107/`，不再是网站素材来源；旧图不得按缓存清理。
- 运行 `npm run check:asset-catalog` 校验图片目录、英文文件名、分类和所有 MP4/封面/海报引用。

## 3:4 卡片封面与原比例播放器海报

两者保持独立：

1. **新增作品**：挑选一个视频时间点，3:4 卡片图由画布导出；播放器海报使用**同一已解码选帧**按原画面比例（含 SAR 修正）缩放保存。不同画幅不会裁切、硬拉伸或强制转换成 16:9。
2. **更换已有作品封面**：默认只替换网站卡片的 3:4 图片，保留播放器先前的原比例选帧、海报文件与原视频尺寸。换封面不意味着换播放器海报。
3. **独立更换播放器海报**：在工作台选择「播放器海报 · 原比例」，明确选择主视频或 B 等版本后从该版本 MP4 选帧。确认后仅更新这一版本的原比例海报与选帧记录，旧图归档至 `.cover-studio/project-revisions/poster-history/`，不会修改 3:4 卡片封面；导入静态图需通过比例校验。
4. **版本与比例**： 一个作品的不同 MP4 版本各自保留独立海报和画幅；海报路径以 `project-video-metadata.json`（主版本）或 `auto-projects.json` 的 `variants[]`（附加版本）为准。

## 验证

```bash
npm run build
npm run check:english-copy
npm run check:overseas-names
npm run check:curated-order
node scripts/check-cover-studio-title-mp4.mjs
node scripts/check-cover-studio-inline-bilingual.mjs
npm run check:asset-catalog
```
