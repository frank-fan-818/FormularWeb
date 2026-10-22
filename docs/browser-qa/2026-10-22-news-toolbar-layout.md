# 新闻筛选区域排版验证

- Date: 2026-10-22
- Branch: `codex/deployed-turnstile`
- Build URL: `http://127.0.0.1:5176/news?category=social`；自动化使用生产构建 4173 端口。
- Files changed: `src/pages/News.tsx`、`src/pages/News.css`；既有新闻浏览器用例增加工具栏截图。
- Routes checked: 新闻全部 / 分类 / Reddit 帖子、来源选择与搜索；必要 smoke 路由（首页、赛历、赛事详情、车手 / 车队 / 赛道详情、设置及账号入口）。
- Viewports checked: 1440×900、768×1024、375×812；含浅色 / 深色与中英切换。
- Findings: 分类使用统一分段控件；内容区足够宽时，分类左对齐，搜索与来源筛选右对齐。窄屏分行，减少标签和上下间距。搜索保留可访问名称与键盘焦点样式，按钮维持 44px 触控高度。没有横向溢出或控件重叠。
- Blocking: 无。

验证结果：新闻单元测试 3 文件 / 17 项通过；严格 ESLint、UTF-8 检查、生产构建通过；浏览器 61 项通过 / 8 项按既有配置跳过。检查页面错误、控制台错误和失败请求，无新增问题。构建保留已有 logger 导入提示。

Screenshot paths（自动化 fixture，截图区域为真实工具栏布局）：

- `artifacts/browser-qa/screenshots/news-toolbar-all-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/news-toolbar-all-tablet-chromium.png`
- `artifacts/browser-qa/screenshots/news-toolbar-all-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/news-toolbar-reddit-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/news-toolbar-reddit-mobile-chromium.png`

本轮仅修改工作区和本地预览，继续准备中的 1.2.0，没有提交或部署。
