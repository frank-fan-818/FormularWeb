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
