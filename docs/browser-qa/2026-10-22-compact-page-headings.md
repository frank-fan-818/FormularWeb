# 全站标题区精简验证

- Date: 2026-10-22
- Branch: `codex/deployed-turnstile`
- Build URL: `http://127.0.0.1:5176/news?category=social`；自动化使用生产构建的 4173 端口。
- Files changed: 公共 ProductMasthead / ProductSectionHeader、AuthCard、车手 / 车队档案、RacePageIntro 及调用页面；公共标题样式、新闻、车队、车手与账号样式；隐私页。
- Routes checked: 首页、新闻与社交精选、赛季积分、赛历、赛事详情及分析、车手 / 车队列表与档案、历史档案、赛道列表与详情、设置、账号入口与隐私页。
- Viewports checked: 1440×900、768×1024、375×812；标题与档案覆盖浅色 / 深色主题。
- Findings: 移除编号和装饰英文标签，标题直接显示；公共标题框上下 padding 为 16px，标题最大 42px；统计栏边距同步调整。新闻筛选、刷新、外链和数据状态正常，档案身份信息与图片没有重叠，未新增横向溢出。
- Blocking: 无。

验证结果：

- 单元测试 101 文件 / 582 项通过；赛事子页补充验证 5 文件 / 23 项通过。
- 严格 ESLint、UTF-8 编码检查、生产构建通过。构建仍有已有 logger 动态 / 静态导入提示。
- 首次浏览器回归 113 项通过、19 项按已有配置跳过；3 个旧断言仍要求被删除的标签，已更新为标签移除及紧凑间距检查。
- 最终复查 40 项通过、8 项按已有配置跳过，包含上述 3 项页头用例、必要路由及赛事分析交互；页头用例检查页面错误、控制台错误、失败请求与横向溢出。
- 本轮仅更新本地工作区及预览，没有提交或部署。

Screenshot paths:

- `artifacts/browser-qa/screenshots/compact-news-user.png`
- `artifacts/browser-qa/screenshots/news-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/news-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/masthead-seasons-light-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/masthead-settings-dark-mobile-chromium.png`
- 各路由其他浅色 / 深色截图保存于同一目录的 `masthead-*` 文件。

## 追加：单行标题和赛道数量

- Branch: `codex/paddock-news-and-reddit`；生产构建预览 `http://127.0.0.1:4173`。
- 将赛道、车手、车队、赛历、积分榜的手动换行改为空格；公共 ProductMasthead 单行显示标题，桌面字号最大 32px、手机 20–24px，上下 padding 降至 12px。不再给未使用的 aside 预留固定列宽；过长的动态赛道名称可省略显示，DOM 和 title 提示仍保留完整名称。
- 赛道页只保留“本季赛道”数量，删除工程数据和冲刺周末统计及附属说明。桌面与标题并排，手机为一行紧凑统计；其他页面仍保留各自统计。统计区字号和间距同步缩小。
- 验证 1440×900、768×1024、375×812 的浅色 / 深色标题，包含赛季积分、赛历、车手与车队列表及档案、赛道列表及详情、设置、赛事页与历史档案。标题回归确认主标题单行、静态列表标题没有截断、赛道仅剩一项统计，以及无页面横向溢出、意外控制台错误或失败请求。
- 单元测试 101 文件 / 586 项通过；生产构建、严格 ESLint、UTF-8、diff 空白检查通过。页头与核心路由浏览器回归 34 项通过、8 项按既有视口规则跳过；新闻页布局、交互与深色补充检查 6 项通过。构建保留已有 logger 动静态导入提示。
- 已检查 `masthead-circuits-light-desktop-chromium.png`、`masthead-circuits-light-mobile-chromium.png` 和 `masthead-races-light-mobile-chromium.png` 等截图，均位于 `artifacts/browser-qa/screenshots/`。截图使用夹具数据，赛道数量 1 为测试数据。
- 本轮按 `style:` 处理，版本保持 1.2.0；保留此前未提交的日程修改，没有提交、推送或部署。

## 追加：独立页头补齐

- 首页、赛事详情及子页、车手 / 车队档案（含复用的历史档案）、旧历史标题、账号表单标题和隐私页标题同步缩小。车手的名和姓改为同一行；长名称保留完整 DOM 文本及 title 提示。档案图片区和上下 padding 同步压缩，保留照片、赛车图片、国籍、赛季、车号与车队身份。
- 复查 Chromium 桌面 1440×900、手机 375×812、平板 768×1024，覆盖浅色 / 深色、档案检索进入、头像 / 赛车图片加载、元数据、首页单行标题、赛事和历史页、账号页及核心路由。
- 单元测试仍为 101 文件 / 586 项通过。生产构建、严格 ESLint、编码和 diff 检查通过。首次浏览器检查 49 项通过、8 项按既有配置跳过；3 项新增单行断言将姓名不同字重的基线盒高误判为换行，已改为同时检查 nowrap 与低于两行的盒高，最终这 3 项在三种尺寸均通过。共 52 个选中用例完成验证。
- 已查看 `driver-hero-desktop-chromium.png`、`team-hero-desktop-chromium.png` 和 `driver-hero-mobile-chromium.png`，并保留其他页头截图于 `artifacts/browser-qa/screenshots/`。未发现文字 / 图片重叠或新的横向溢出；测试监听未发现意外页面错误、控制台错误或失败网络请求。
- 尚未提交、推送或部署；版本仍为 1.2.0。
