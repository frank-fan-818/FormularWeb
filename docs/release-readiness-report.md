# Release Readiness Report — 0.20.12

Date: 2026-10-03 (Asia/Shanghai)

## 当前判断

当前是本地发布候选版本，尚不能宣称完成生产发布。基线提交为
`641bee9c5f91e930375b52ae888b864db08ee671`，下述修复作为本次本地提交内容；生产配置、
Linux 安全扫描和发布回滚必须针对最终发布提交重新验证。2026-10-05 按用户要求
将工作区最新内容全部提交，包含原有 `docs/blog/`，其正文未修改。

## 本轮闭环

- 修复首页、跨页赛周提示、积分榜选中标签在暗色模式下的白字浅底问题，改用稳定的深色表面 token。
- 游客预测提示改为紧凑布局，继续保留权限边界与登录返回地址；首页预测摘要按需加载。
- 空积分榜不再错误撑出三行占位高度；空、错误与加载状态继续保留。
- 首页增加赛周日期，已结束场次保留可读对比度；长标题均衡换行；扩大触控目标和加强键盘焦点。
- 增加跳转正文入口。登录页主内容第一帧可见，移除无状态意义的循环装饰动效。
- 登录页改用原生基础控件，保留提交禁用、错误反馈、密码显示、原生字段校验和退出行为。
- 普通根路径首次访问提前进入公开登录页，在 SDK 初始化期间显示禁用表单；保存会话、游客、
  查询参数或 hash 回调仍走原有状态确认路径，存储提示不授予权限。
- 合并小型启动公共模块，并预加载两个小型账号入口模块，保持原有所有体积预算；安全扫描排除已被 Git 忽略的下载工具链与生成报告。
- 修复切换赛季时旧缓存显示在新赛季下、过期异步响应覆盖当前数据的问题；离线与刷新失败仍保留正确赛季的可用缓存。
- 密码恢复授权经过令牌刷新后继续保留，完成密码更新后退出恢复状态；补订阅竞态、超时、重试和卸载回归。
- 线图、柱图和散点图增加按序列切换的分页数据表；轴文字随主题更新，保留原有车手与状态语义色，修复 WebKit 原生控件的主题不一致。移动端刻度默认避让，避免末端数字挤在一起。
- 交付带 OFL 授权的自托管字体，按 UI 字形拆分，8 文件合计约 118 KiB；标题独立预加载，字体失败仍可读。增加覆盖、文件哈希和许可证门禁。
- 首次公开账号页绘制后再加载会话 SDK，框架与卡片并行请求；已有会话与认证回调立即发现会话，未收到绘制信号时仍有超时回退。
- 增加内容派生的发布身份、GET-only 生产探针、每六小时健康工作流和可执行发布/回滚手册。探针响应在读取时限制 2 MB，不持久化原始响应或异常。
- 按 `fix:` 更新候选版本 0.20.11 → 0.20.12，同时更新锁文件；完成本地提交，尚未创建标签或部署。

## 当前验证证据

| 检查 | 本轮结果 |
| --- | --- |
| 单元测试与覆盖率 | 71 文件 / 411 测试通过；54.65% statements、49.47% branches、54.70% functions、55.59% lines |
| TypeScript / 生产构建 | 通过 |
| 严格 ESLint / UTF-8 编码 | 通过 |
| 配置 / 工作流 / 本地媒体 | 通过；7 工作流及 44 项回归、6 项生产探针回归、27 车手 / 12 车队媒体 |
| 秘密与 SQL 策略静态扫描 | 通过；不能替代生产 RLS 实测 |
| 全依赖审计 | 0 vulnerabilities |
| Service Worker | 生成验证及 7 项新鲜度测试通过 |
| 性能体积预算 | 通过：初始 78.8 KiB、首页 91.9 KiB、Race Info 312.2 KiB、Analysis shell 438.3 KiB gzip；ECharts 191.5 KiB、最大 chunk 135.5 KiB |
| 账号与新增视觉回归 | 覆盖首帧、SDK 延迟、回调保留、游客与会员边界 |
| 浏览器回归 | Chromium 全路由，Firefox / 移动 WebKit 核心流程；187 项通过、35 项按套件设计跳过（222 项总计） |
| 最终图表修复回归 | 5 个浏览器/视口通过；检查 Canvas 实际绘制的刻度边界，验证无文字重叠，并重新捕获亮暗主题截图 |
| Lighthouse | 5 次通过，中位 performance 96、accessibility / best practices / SEO 100；LCP 2470.57ms、CLS 0.00089、TBT 56ms |
| 字体交付 | 8 WOFF2、660 UI 中文字形、标题覆盖、OFL 许可证、SHA-256 与失败回退通过 |
| Semgrep | 沙盒外通过：4 条原有规则扫描 754 源码目标，0 findings；最终提交仍需 Linux CI |

自动回归覆盖 1440×900、768×1024、375×812；首页亮暗主题、长标题、
空状态、键盘跳转、减少动效、游客不请求私有数据，以及 SDK 延迟时表单仍禁用。
新增 Firefox 和移动 WebKit 核心矩阵，验证字体请求失败可读、图表数据表分页和主题
切换、首次账号内容在 SDK 请求前可见。WebKit 触控模拟以显式焦点验证跳转入口激活，
没有把这个检查当成真实 iOS 硬件 Tab 顺序的证据。
截图与运行日志位于 `artifacts/browser-qa/` 和本地 `artifacts-release-*.log`，均不进入版本控制。
浏览器测试使用受控数据和认证夹具，不能视为真实生产账号与数据库验证。

Lighthouse 仍有非阻塞提示：FCP 1761.05ms，关键请求链与未使用 JavaScript 尚可优化；
旧 `render-blocking-resources` audit 在当前 Lighthouse 版本不再提供，新 insight 同时保留。
性能体积和 LCP 均保持原有门槛，没有通过放宽标准来获得通过结果。

## 发布前仍需完成

1. **P0：最终提交门禁。** 在 Linux CI 跑完 `quality:check`，包含 Semgrep。核实最新工作流与分支保护，不能引用旧版本成功记录；本地通过不替代最终提交的 CI 与生产验证。
2. **P0：生产访问边界。** 重新验证数据库迁移、RLS、匿名禁止写入、私有 Storage、预测会员读取与诊断数据脱敏；确认 `/login`、`/reset-password` 与 PKCE 回调配置，使用专用账号验证完整恢复与退出链路。
3. **P0：真实数据与发布验证。** 抽样核对当前赛周的比赛结果、练习赛、遥测和预测的新鲜度与数据缺失说明；复核最近自动同步任务健康报告。发布后验证 `/f1-api`、安全/缓存头、缺失资源 404 和多标签页升级。
4. **P0：回滚与运行责任。** 记录可回滚部署、执行回滚演练，指定故障和同步任务失败的处理责任人与告警接收人；验证告警确实可达，避免只有日志没有处理闭环。
5. **P1：实际设备与公开使用范围。** 验证真实 iOS 设备、硬件键盘、屏幕阅读器及 200% 缩放；确认媒体与数据授权适用于拟公开使用范围。字体授权已随文件交付，旧 React Router 6 风险已在风险登记中标为历史记录。

本轮对文档中的生产 URL 执行只读探针，结果为 `availability: unreachable`，因此没有把生产头、
生产部署版本或数据库状态标为已验证。也没有进行生产写入或账号重置。

## 视觉品质自检与剩余设计工作

| 维度 | 本轮自检 | 下一阶段验收 |
| --- | --- | --- |
| 排版 | 长标题换行、主要信息首帧可读；授权字体自托管、中文覆盖和失败 fallback 通过 | 任意上游姓名与非 UI 字形仍使用系统 fallback；真实设备字体栅格复查 |
| 留白 | 收紧游客提示与空状态，避免信息被空白面板挤走 | 真实满量遥测与长名单的页面节奏复查 |
| 视觉层级 | 当前赛事 → 操作 → 核心指标 → 赛周与积分 | 关键用户任务的首次点击与完成时间测试 |
| 色彩 | 统一固定深色面板，修复主题反转、登录对比度、图表轴文字及原生控件主题 | 实际遥测的悬浮提示、色觉差异与语义色理解测试 |
| 动效 | 取消主内容透明淡入及循环装饰；保留动作反馈，减少动效可用 | 慢设备与 Safari 下帧率/触控验证 |
| 微交互 | 44px 关键触控目标、可见焦点、跳转正文、提交禁用；图表分页表支持键盘读取 | 200% 缩放、屏幕阅读器及真实键盘整站巡检 |
| 响应式 | Chromium 桌面/平板/手机全路由与 Firefox、移动 WebKit 核心流程回归及截图 | 真实 iOS、低性能设备触控与硬件 Tab 顺序；WebKit 触控模拟使用显式焦点验证跳转入口 |
| 原创性 | 现有赛事指挥台语言一致，强调真实赛周、状态和分析任务 | 建立一个能让用户记住的完整分析体验，例如圈速差与赛道位置的联动；需要完整产品设计与验证，不能以装饰特效代替 |

参考 [Awwwards 评审标准](https://www.awwwards.com/about-evaluation/)：设计 40%、
可用性 30%、创意 20%、内容 10%；[Webby 评审标准](https://www.webbyawards.com/judging-criteria/)
还强调导航、功能、交互、创新和整体体验。FWA 官方 about 页本轮未返回可提取正文，
没有臆造其评分权重。上述是内部工程与设计审查，不能当作外部奖项评分或获奖认证。

本轮已修复实际审查发现的工程和视觉缺陷。用户研究、真实设备和线上运行仍可带来新的发现，
不能把自动回归通过等同于外部获奖或“永远没有可提升之处”。最终产物对应本地
`0.20.12 / 1831afd7dc64`；生产探针尚未确认这个构建在线上运行。

---

# Historical release report — 0.12.3 (superseded)

The following evidence describes the July candidate only and does not verify 0.20.12.

Date: 2026-07-28
Candidate version: 0.12.3

## Outcome

The repository is now a release candidate rather than a development-only
dashboard. Automated gates cover source quality, dependency risk, secrets,
database policy regressions, unit coverage, production builds, bundle budgets,
Lighthouse, and multi-viewport browser smoke tests.

The repository evidence below was re-run for the 0.12.3 candidate. Production
database and authentication verification from 0.12.1 remains the baseline;
the production rollout requirements at the end of this report must be checked
again for the exact 0.12.3 release commit.

## Gap closure

| Area | Before | Release-candidate state |
| --- | --- | --- |
| Authentication | Login UI did not create a real session | Supabase sign-in, sign-up, reset, recovery, session restore, and sign-out |
| Database writes | Temporary anonymous write policies and browser-capable admin scripts | Cleanup migrations, service-role-only admin scripts, RLS, public read-only data, caller-secured view, authenticated diagnostic inserts bound to `auth.uid()` |
| Dependency security | High and critical findings in runtime/tooling dependencies | Zero high or critical findings; two no-fix moderate React Router advisories are mitigated and recorded |
| Secret handling | Manual review only | Release-candidate scan covers tracked and untracked non-ignored files, rejects tracked env/private-key files, and checks credential patterns, unsafe SQL grants, and dangerous browser sinks |
| CI | Tests/build with permissive lint | Strict lint, types, coverage, audit, Semgrep OSS, workflow safety validation, Dependabot, build, bundle budgets, Lighthouse, and browser QA |
| Routing | No product 404 and untrusted cached search route reached `navigate` | Branded 404 plus a tested same-origin route boundary |
| Privacy | No user-facing account/diagnostic disclosure | Privacy page and recovery-safe URL redaction |
| Data delivery | Direct upstream browser requests could fail CORS | Same-origin development, preview, and Vercel proxy |
| Resilience | No production offline shell | Content-versioned service worker with multi-tab build coordination, bounded data caching, and client-confirmed stale-shell cleanup |
| Performance | Search eagerly loaded Supabase; route waterfall | Intent-loaded search/i18n, eager home shell, and enforced route budgets |
| Browser quality | No repeatable release evidence | Desktop 1440×900, tablet 768×1024, mobile 375×812; console, asset, route, and overflow assertions |
| Release process | No single reproducible gate | `npm run quality:check`, release checklist, security policy, SemVer 0.12.3 |

## Verified evidence

- 40 unit-test files and 240 tests passed.
- Coverage gate passed at 46.00% statements, 40.02% branches,
  46.86% functions, and 46.13% lines.
- Strict ESLint and TypeScript checks passed.
- Production build and service-worker generation passed.
- Initial/home JavaScript path: 119.6 KiB gzip.
- Race Info path: 338.1 KiB gzip.
- Race Analysis shell: 458.5 KiB gzip.
- Largest JavaScript chunk: 133.8 KiB gzip.
- Lighthouse median across five independent runs: performance 0.97, accessibility 1.00,
  best practices 1.00, SEO 1.00.
- Browser QA: 29 applicable tests passed across desktop, tablet, and mobile;
  16 intentionally redundant viewport-specific interaction checks were skipped.
- The browser suite exercises a real two-tab Service Worker upgrade, proves
  both in-memory builds reload, and verifies the previous shell is only pruned
  after every client reports the current build.
- Live Jolpica proxy check returned HTTP 200 and a valid `MRData` payload.
- Dependency gate found zero high or critical vulnerabilities.
- Secret/policy scan passed across tracked and untracked release-candidate files.
- Production Supabase verification found zero browser write grants, zero
  unexpected browser write policies, zero public-read tables missing RLS, and
  12 matching public-read policies.
- The Supabase security advisor returned no issues after the migration.
- Supabase Auth `site_url` is `https://formular-web.vercel.app` and its
  redirect allow-list contains `https://formular-web.vercel.app/login`.
- Both temporary Supabase management tokens used for deployment verification
  were deleted locally and revoked from the account.

## Accepted and bounded residuals

- React Router 6 has two no-fix moderate advisories. The SSR path is not used,
  and untrusted navigation is rejected by `isSafeInternalRoute`. See
  `docs/security-risk-register.md`.
- Aggregate coverage is an enforced baseline, not a final ceiling. Pure
  utilities are well covered; large database adapters and React hooks remain
  the priority for future test growth. The threshold must only move upward.
- Lighthouse still reports non-blocking render-chain diagnostics. Core Web
  Vitals and the blocking score thresholds pass; further CSS extraction is an
  optimization opportunity, not a release blocker.

## Production rollout requirements

1. Apply `scripts/sql/2026-07-28-production-security-hardening.sql`
   transactionally to the production project and re-run it to prove
   idempotency.
2. Read back grants and policies: anonymous users must remain read-only, while
   authenticated users may only insert their own redacted diagnostic rows.
3. Read back the Supabase Auth production site URL and `/login` redirect URL.
4. Deploy the exact `v0.12.3` release commit to Vercel, then verify security
   and cache headers, critical routes, missing-asset 404 behavior, the
   Service Worker build ID, and the `/f1-api` rewrite on the production URL.
5. Keep the previous production deployment as the rollback target and review
   post-release error-log volume.
