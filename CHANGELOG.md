# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

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
