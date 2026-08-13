# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

## [0.13.2] - 2026-08-13

### Fixed

- Prefer bundled FastF1 snapshots so a Supabase outage cannot block RaceDetail analytics.
- Fall back to a hedged Jolpica search index when Supabase is unavailable or returns an empty index.
- Invalidate stale empty search caches and avoid persisting incomplete fallback indexes.

## [0.13.1] - 2026-08-13

### Fixed

- Stabilize error reporter assertions when asynchronous diagnostic writes overlap test cleanup.

### Performance

- Load RaceDetail diagnostic trace processing outside the critical route bundle and retain a strict 341 KiB Race Info budget.

## [0.13.0] - 2026-08-11

### Added

- 为 RaceDetail 增加贯穿路由、数据源、降级、Hook 状态和渲染聚合的关联诊断日志
- 增加安全诊断编号、浏览器会话环形缓冲、Supabase 诊断字段和排查手册

## [0.12.3] - 2026-07-28

### Fixed

- 修复部署后旧页面加载已删除代码分片时反复报错的问题，并阻止 HTML 被当作 JavaScript 缓存
- 修复多标签页发布升级时新 Service Worker 与旧内存代码混用，以及旧 shell 缓存无界增长的问题
- 修复历史赛事切换标签或赛季时丢失赛季身份的问题
- 修复赛季结束后已完赛赛事同时出现在“前方赛程”和“已完成比赛”的问题
- 修复全局搜索遗漏早期赛事、单个数据源失败导致全部搜索不可用的问题
- 修复设置页与页头语言选择状态不同步，以及英文界面混入中文搜索文案的问题
- 修复已登录用户无法写入生产错误日志，并在持久化前脱敏凭据与敏感 URL

### Security

- 移除当前私有个人仓库无法使用的 CodeQL 上传工作流，增加可执行的工作流、部署路由、编码和密钥检查
- 隔离预测数据刷新任务的只读计算权限与写入 PR 权限，并固定 GitHub Actions 到提交 SHA
- 阻止 Dependabot 将不兼容的生产依赖 major 升级合并到同一个 PR
- 固定 Node、npm 与 Semgrep 版本，并让本地与 CI 使用同一套可复现门禁

## [0.2.2] - 2026-04-13

### Changed
- 积分榜车队名称、胜场数、进度条纵向对齐
- 车手库信息横向排列，卡片更紧凑
- 统一页面背景为白色
- 积分徽章使用车队代表色（调暗版本）
- 优化侧边栏和顶部导航视觉统一性

## [0.2.1] - 2026-04-13

### Changed
- 优化赛道库列表页和详情页的图片尺寸
- 调整赛道图显示比例，提升视觉效果

## [0.2.0] - 2026-04-13

### Added
- 全新设计系统 - 基于 Ferrari + Vercel + Linear 的设计语言
- design-tokens.css - CSS 变量设计令牌系统
- 温暖的米黄色主题背景 (#F7F7F5)
- 统一的间距、圆角、阴影系统
- 页面加载动画和交互动效

### Changed
- 重构首页 Hero 区域样式
- 重构统计卡片组件
- 重构积分榜组件
- 更新赛道库页面样式
- 更新赛道详情页样式
- 更新车手详情页样式
- 更新布局组件样式
- 精简赛道库列表信息展示
- 统一所有页面视觉风格

## [0.1.1] - 2026-04-12

### Fixed
- 修复导航检查导致无法跳转其他页面的问题（使用 useRef 确保只执行一次）

## [0.1.0] - 2026-04-12

### Added
- F1 Dashboard with Jolpica API integration
- 赛季中心页面 - 查看赛季信息和积分榜
- 分站赛事页面 - 查看各分站比赛详情
- 车手库页面 - 浏览所有车手信息
- 车队库页面 - 浏览所有车队信息
- 赛道库页面 - 浏览所有赛道信息
- 车手详情页 - 显示车手生涯数据和积分走势图
- 车队详情页 - 显示车队历史数据和积分走势图
- 赛道详情页 - 显示赛道信息和历史记录
- 移动端响应式布局支持
- 抽屉式侧边栏（移动端）
- 积分走势图表（支持交互）
- 积分走势图表支持手机端左右滑动
- 积分走势图表支持双指缩放
- 新打开网站时自动定位到首页

### Fixed
- 修复刷新页面404问题（添加 vercel.json rewrites）
- 修复图表不显示问题
- 修复手机端侧边栏闪烁问题
- 修复生产环境API代理问题
- 修复TypeScript编译错误

### Changed
- 优化移动端响应式布局
- 优化车手/车队/赛道详情页UI
- 优化积分进度条动画

---

## Version History

| Version | Date | Type | Description |
|---------|------|------|-------------|
| 0.1.0 | 2026-04-12 | feat | Initial release with core features |

---

## Version Naming Convention

- **Major (X)**: Breaking API changes
- **Minor (Y)**: New backward-compatible features  
- **Patch (Z)**: Backward-compatible bug fixes

### Commit Type Mapping

| Commit Type | Version Change |
|-------------|----------------|
| `feat:` | Minor +1 |
| `fix:` | Patch +1 |
| `refactor:` | Patch +1 |
| `perf:` | Patch +1 |
| `docs:`, `style:`, `test:`, `chore:` | No version change |
