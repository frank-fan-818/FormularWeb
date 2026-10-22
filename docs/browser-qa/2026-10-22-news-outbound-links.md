# 新闻与精选直接原文链接 QA

- 日期：2026-10-22（Asia/Shanghai）
- 版本：1.2.0，仍为同一未提交新闻功能，本轮未部署。
- 本地预览：http://127.0.0.1:5176/news
- 自动化：构建产物服务 4173，完成后关闭。

## 当前行为

用户决定回到链接聚合。新闻标题 / 查看原文、精选标题 / 打开原帖均直接链接已核实的来源 URL，在新标签页打开，保留列表。导读文本、RSS 简介字段 / 解析、站内阅读与精选详情路由、Reddit iframe 及其额外 CSP 域名已移除。此前被要求删除的来源侧栏、统计栏和精选介绍区继续不显示。

主要文件：`src/pages/News.tsx`、`src/components/news/CuratedPosts.tsx`、`src/data/curatedPosts.ts`、`src/utils/news.ts`、新闻类型、路由和 locales。纯文本元数据仍校验来源 URL / 日期，按时间排序、去重、过滤 FIA 非 F1 公告；新闻故障保留最后成功缓存。

## 验证

- 全套单元测试：101 文件、582 项通过。
- `npm run build`：通过；日志 `artifacts/news-outbound-build.log`。
- `npm run lint:strict`、`npm run encoding:check`：通过，470 个 UTF-8 源文件。
- `npm run deployment:verify`：8 项通过，确认固定代理和 CSP 未包含额外 Reddit frames / scripts。
- `git diff --check`：通过。

```powershell
node scripts/run-browser-qa.mjs e2e/news.qa.spec.ts e2e/smoke.spec.ts --project=desktop-chromium --project=mobile-chromium --project=tablet-chromium --grep 'news |renders without a browser error'
```

结果：55 项通过、8 项按既有 smoke 规则跳过，无失败。新闻相关 8 场景 × 3 视口：桌面 1440×900、手机 375×812、平板 768×1024。

- 实际点击新闻标题 / 操作链接、精选标题 / 操作链接，验证新标签页的首个目标即精确来源 URL，没有站内导读中间页面。测试仅用目标站 HTML fixture 隔离外部可用性，不把目标站是否返回 200 当作本站链接正确性的依据。
- 验证分类、来源筛选、搜索、空结果、分页、刷新、部分 / 全部来源失败与恢复、缓存、双语、时区与深色。
- 上游 HTML / 脚本 / 图片不会进入列表或执行，URL 保留白名单检查。精选点击前没有 Reddit 请求，页面没有 iframe 或本地阅读入口。
- 列表主要流程检查 console error / warning、pageerror 与失败请求；排除唯一已知测试提示为 Playwright 主动禁止 Service Worker。
- 既有首页、赛事、车手、车队、赛道、账号、设置与 404 路由执行 smoke；移动 / 平板沿用已有 smoke 跳过范围。

截图：

- `artifacts/browser-qa/screenshots/news-{desktop,mobile,tablet}-chromium.png`
- `artifacts/browser-qa/screenshots/news-picks-{desktop,mobile,tablet}-chromium.png`
- `artifacts/browser-qa/screenshots/news-dark-{desktop,mobile,tablet}-chromium.png`
- `artifacts/browser-qa/screenshots/news-picks-dark-{desktop,mobile,tablet}-chromium.png`

## 限制

外部站点访问受用户网络及来源服务影响。RSS 技术接入与原文链接展示不等于本站已取得全文转载许可；本轮没有申请或发布全文。

本报告取代 2026-10-21 报告中关于站内导读 / Reddit 嵌入的当前交付说明；旧报告和设计文档保留为历史记录。

## Reddit 原始英文标题调整

按用户要求，精选帖子直接显示 `originalTitle`，删除手写的中英文概括标题；搜索按原始标题匹配，网站语言切换不改变帖子标题。原帖链接保持直接跳转。

- 新闻相关单元测试 3 文件 / 13 项通过，严格 ESLint、UTF-8 检查和生产构建通过。
- 精选帖子浏览器检查 6 项通过，覆盖桌面 1440×900、手机 375×812、平板 768×1024；验证英文标题、搜索、空结果、切换语言、直接打开原帖和 RSS 故障下的深色主题显示。
- 未新增页面错误、控制台错误或失败请求；长英文标题没有产生横向溢出。
- 用户预览已刷新，截图：`artifacts/browser-qa/screenshots/reddit-original-titles-user.png`。
