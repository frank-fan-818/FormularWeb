# 进站数据与 DHL 排行榜 QA

- 日期：2026-10-25（Asia/Shanghai）。
- 分支：`codex/official-circuit-map-release`（沿用当前工作区）。
- 环境：本地生产构建，Vite preview `http://127.0.0.1:4175`；自动化夹具验证使用 `scripts/serve-dist.mjs`。
- 范围：`/pit-stops?season=2025`、单站榜、`/races/4/results?season=2025`；现有首页、赛事列表、赛事详情、车手、车队、赛道等路由回归。
- 视口：1440×900、768×1024、375×812。

## 验证

- `node --test scripts/pit-stops.test.mjs`：9 项通过，覆盖来源发现、分页、并列、官方名次、会话与分站匹配、独立计时、非法请求。
- `npm test`：112 个测试文件、684 项通过。
- `npm run build`、严格 lint、UTF-8 检查通过。构建仍有既有 logger 静态 / 动态导入提示。
- `npm run budget:performance`：首页、比赛页及图表体积预算通过；可选分析 API 未进入比赛成绩的静态依赖。
- 新功能浏览器自动化：桌面 / 平板 / 手机共 6 项通过，覆盖游客访问、榜单切换、URL 分站定位、返回比赛、筛选、独立排序、加载、空数据、失败与重试。
- 既有路由 smoke：桌面 13 项通过，包含项目 checklist 的主要路由。

## 真实数据核对

数据请求未使用夹具；仅屏蔽本地无须上报的 Web Analytics 脚本。

- DHL 2025 赛季：10 支车队；2026 赛季服务端样本为 11 支车队，未写死车队数量。
- 2025 巴林：42 条 Jolpica 明细，40 条可唯一匹配 OpenF1 静止计时，2 条显示 —。
- 同站 DHL：10 条官方最快记录；名次与积分采用官方表格 / JSON，并核对事件 ID。相同显示用时不自行重排名次。
- 手机端横向溢出为 0；真实比赛明细到 DHL 榜单跳转正常。
- 最终真实数据流程：控制台错误 0、失败请求 0。

## 截图

- `artifacts/browser-qa/screenshots/pit-season-desktop-chromium.png`
- `artifacts/browser-qa/screenshots/pit-event-tablet-chromium.png`
- `artifacts/browser-qa/screenshots/pit-records-mobile-chromium.png`
- `artifacts/browser-qa/screenshots/pit-live-season-desktop.png`
- `artifacts/browser-qa/screenshots/pit-live-event-mobile.png`
- `artifacts/browser-qa/screenshots/pit-live-records-mobile.png`

截图和浏览器 trace 为本地 QA 产物，不提交。

## 边界

- 本轮未提交、推送或生产部署；未验证线上运行。
- 当前服务器 / CDN 按需缓存，不包含数据库持久快照与定时历史回补；进程缓存不能替代持久备份。
- 基础明细从 2011 年起查询；更早 F1DB 历史暂未接入。来源缺失与暂时不可用均保持显式状态。
- DHL 接口属于其网站所用接口，非公开版本化服务；布局、接口或来源使用条件变化时须复核。
- 本地功能验证无阻塞项；生产上线须完成仓库发布流程及来源使用条件复核。
