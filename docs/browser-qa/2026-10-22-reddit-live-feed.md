# Reddit 自动更新验证

- Date: 2026-10-22
- Branch: `codex/deployed-turnstile`
- Build URL: 本地预览 `http://127.0.0.1:5176/news?category=social`；自动化使用生产构建 4173 端口。
- Routes checked: `/news`、`/news?category=social`、首页、赛历、赛事详情、车手 / 车队 / 赛道详情、设置与账号入口等必要 smoke 路由。
- Viewports checked: 桌面 1440×900、手机 375×812、平板 768×1024；含深色模式。
- Findings: Reddit 已从固定 3 条改为官方 Atom 源；来源本次返回 50 条，页面首批 15 条、最多显示来源当前 50 条，可继续加载。使用真实发帖时间、英文原标题和原帖链接。全部分类纳入 Reddit，分类切换不残留冲突的来源条件，手机端可刷新 Reddit。
- Blocking: 无本地阻塞；没有部署到托管环境验证 Reddit 的访问可用性。

验证证据：

- 新增链接约束、页面自动刷新测试先失败，再通过实现验证。
- 单元测试：101 文件 / 586 项通过。
- 严格 ESLint、UTF-8 编码、生产构建通过；8 项部署配置测试通过。构建保留已有 logger 动态 / 静态导入提示。
- 浏览器：61 项通过 / 8 项按既有配置跳过，包含新闻 30 项和必要路由检查。
- 验证自动刷新在 5 分钟后更新内容、取消旧请求、隐藏页面暂停与恢复、50 条分页、英文搜索、外链 popup、Atom 的命名空间与不安全链接 / 日期过滤、仅保留元数据、空源与故障恢复。
- Reddit 成功结果在当前浏览器中作为故障缓存使用，超过 24 小时不再显示。页面重新加载后，来源故障仍能恢复有效的旧结果并标注更新失败；存储不可用不阻断在线读取。
- 浏览器自动化使用可控 fixture 验证故障 / 时间边界；无新增页面错误、控制台错误、失败请求或横向溢出。
- 另行真实数据验证：Reddit 官方直连系统请求 HTTP 200 / Atom / 50 条；网站固定接口 `/news-feed/reddit` HTTP 200 / Atom / 50 条；原有 Motorsport 接口 HTTP 200 / 50 条、FIA HTTP 200 / 10 条（FIA 条目还需前端 F1 标题过滤）。

本地网络说明：

- 本机系统已启用网络代理。PowerShell 自动沿用系统代理，Node 直接请求时连接被重置。
- Vite 的订阅代理显式使用 `https.Agent({ proxyEnv: process.env })`，以支持操作者提供的标准代理环境变量，保留 TLS 校验。
- 当前预览进程已沿用系统现有代理启动；没有更改系统代理配置或把本机代理地址写入源码。之后自行重启开发服务时，若网络仍需代理，应设置 `HTTPS_PROXY` / `HTTP_PROXY`，并将 `localhost,127.0.0.1` 放入 `NO_PROXY`。构建测试服务器的 fetch 可使用 Node 24 的 `--use-env-proxy`。
- 技术依据：[Node.js 内置代理支持](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html#built-in-proxy-support)。
- 来源与限制：[Reddit 官方订阅源](https://www.reddit.com/r/formula1/.rss?limit=50)；[Reddit 开发者访问说明](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data)。本机成功不保证所有云端网络成功；如托管环境要求 OAuth，应按官方访问流程接入，不能用其他域名或第三方镜像绕过。

Screenshot paths（自动化 fixture）：

- `artifacts/browser-qa/screenshots/news-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/news-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/news-picks-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/news-picks-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/news-picks-dark-mobile-chromium.png`

当前改动仅在工作区和本地预览中，仍准备版本 1.2.0；没有提交、推送或部署。
