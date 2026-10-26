# 美国站赛道参数、天气与进站榜修复

- 日期：2026-10-26。
- 分支：`codex/season-fastest-pit-stop`；本地源码，未提交、推送或部署。
- 对应截图：2026 第 18 站 United States Grand Prix；源比赛日期为 2026-10-25，北京时间为 2026-10-26 04:00。
- 验证地址：本地生产构建 `http://127.0.0.1:4173`；验证结束后临时服务关闭。

## 根因与改动

1. **赛道参数**：分站情报只读取左右弯增强资料，未共用完整赛道参数。`getCircuitEnhancement` 现在统一解析 API 别名并补入本地基础方向、弯道数量；`RaceWeekendOverview` 正确显示美国站“逆时针 / 20”。缺少左右弯分布的历史赛道仍可显示已知弯道总数。
2. **天气**：只读核查发现，数据库和私有 Storage 的 `2026/18/R` 都是 2026-05-28 生成的空占位，未包含实际天气。保留 FastF1 优先级；其天气缺失时，由独立接口读取同场 OpenF1 观测。按年份、正赛、比赛日期和地点匹配 session，再过滤场次 ID、正赛时间窗及未来样本，不把第 18 轮误作 OpenF1 session key。来源在页面显示为“OpenF1 · 正赛实测”。
3. **DHL 进站榜**：以真实响应复现 `DHL event mismatch`。当前事件响应缺少 `event_id`，但含有效成绩与官方 HTML 表格。现在先从官方目录匹配场地；若响应提供 ID，仍严格校验；未提供 ID 时进一步校验成绩日期。保留官方表格名次与 `2.30` 等时间精度，不改写成图表中的 `2.3`。
4. **按需加载**：天气补取客户端在需要回退时才载入。性能检查发现首页接近已有 92 KiB 上限，删除登录壳重复导入 AuthCard 的预载；页面模块本身已包含该依赖。首访绘制与 SDK 延迟的浏览器测试确认行为保持正常，未提高预算上限。

## 天气接口契约

`GET /api/race-weather?season=2026&round=18`；仅接受 GET / HEAD，需要 `Authorization: Bearer <用户令牌>`。

| 项目 | 约定 |
| --- | --- |
| 请求 | `season`：2023 至当前年份后一年的四位年份；`round`：正整数，最多两位 |
| 成功 | `{ season, round, source: "openf1", updatedAt, sessionKey, summary }`；汇总温度最小/最大/平均、湿度、降雨观测数、最大风速 |
| 尚无观测 / 未来比赛 / 无唯一场次 | HTTP 200，`summary: null`；不生成天气或用其他场次填充 |
| 参数错误 | HTTP 400，`{ code: "INVALID_PARAMETERS", message }` |
| 未登录 / 无效令牌 / 匿名用户 | HTTP 401，`{ code: "MEMBER_REQUIRED", message }` |
| 来源或身份服务失败 | HTTP 502，`{ code: "WEATHER_UNAVAILABLE", message }`，页面可重试 |
| 缓存边界 | `Cache-Control: private, no-store`，`Vary: Authorization`；共享缓存仅用于公开上游天气原始数据 |

服务器通过 Supabase `/auth/v1/user` 验证真实身份，用户令牌不传给天气提供方。客户端完成下载后再次核对账号；切换分站、退出或更换账号时取消旧请求并拒绝旧数据。没有圈时数据时不编造降雨圈段，也不显示“0 段降雨区间”。

## 来源实读

- [Jolpica 美国站](https://api.jolpi.ca/ergast/f1/2026/18/results.json?limit=100)：确认当前比赛、日期、Austin / USA 与 22 名赛后结果。
- [OpenF1 正赛场次](https://api.openf1.org/v1/sessions?year=2026&session_name=Race&country_name=United%20States)：正确匹配 Austin 的 `11396`，区别于 Miami / Las Vegas。
- [OpenF1 天气](https://api.openf1.org/v1/weather?session_key=11396)：读取 159 条源观测，过滤赛前、赛后及不匹配场次样本后，赛道温度 34.1–37.8 ℃，气温 26.7–27.6 ℃，最大风速 3.6 m/s，无降雨观测。此为该次读取的历史实测汇总。
- [DHL 美国站事件](https://inmotion.dhl/api/f1-award-element-data/7373?event=1185)：修复后实际返回 10 条计分图成绩，首条 Piastri / McLaren / 2.11 秒。表格中存在图表未列出的不计分停站，因此保留官方名次间隙，不人为重排名次。
- 本地只读核查输出：忽略目录 `artifacts/latest-race-repair/source.json`。回归测试固定 DHL 原始公开样本为 `scripts/fixtures/dhl-event-2026-austin.json`。
- 本轮没有写入生产数据库或私有 Storage，也没有声称修复整包遥测采集；天气现在可以独立使用已存在的同场观测。

## 验证

- 全量 Vitest：118 个文件、932 项通过。
- 接口及部署边界：`npm run deployment:verify` 的 29 项通过，含新的天气鉴权、参数、场次匹配、空数据与上游失败检查，以及 DHL 响应兼容性。
- 生产构建、TypeScript、严格 ESLint、UTF-8 和敏感信息扫描通过。
- 性能预算最终通过：初始 JS 80.5 KiB gzip，首页路径在 92 KiB 上限内，Race Info 245.7 KiB gzip；可选分析 API 未进入赛道关键数据路径。
- 赛道信息 / 天气 / DHL 专项与原进站流程：21 项浏览器测试通过，覆盖加载、实际空观测、读取失败和重试、精度、跳转和移动端布局。
- 最终构建复测最新站修复、通用路由及登录首屏：46 项通过、8 项按既有配置跳过。包含必测 `/`、`/races`、`/races/1`、车手、车队及赛道详情。
- 尺寸：桌面 1440×900、手机 375×812、平板 768×1024。检查无页面横向溢出。已直接查看桌面/手机天气、手机进站截图，关键数值与标签可读。
- 控制台保留并单独断言本测试主动制造的两个 FastF1 `source_empty` 降级警告；无其他非预期警告、异常或失败请求。失败/重试用例中的模拟 502 为预期状态。
- 截图：`artifacts/browser-qa/screenshots/latest-race-weather-{desktop,mobile,tablet}-chromium.png`、`latest-race-pit-{desktop,mobile,tablet}-chromium.png`。

主要文件：`api/_lib/pit-stops.mjs`、新增 `api/race-weather.mjs` 与天气汇总模块、`src/api/raceWeather.ts`、`src/hooks/useRaceWeatherSummary.ts`、`src/pages/Race/RaceInfo.tsx`、两个信息组件、`src/utils/circuitEnhancements.ts`；本地开发/QA 服务及对应契约、单元、浏览器测试同步更新。

本轮验证无阻塞问题。上线仍须遵守当前批次提交和发布授权规则。

## 后续补充：DHL 自动更新核查

用户追问自动更新后，检查发现旧实现只有进入页面、切换参数及手动重试会取数；页面长期打开不会自行刷新。已补全以下机制，仍保留为本地未提交改动：

- `usePitStops` 在可见且在线时每 5 分钟检查数据；回到页面、窗口重新获得焦点或网络恢复时主动刷新。后台和离线期间暂停取数，恢复后重新检查。
- 命中前端缓存的重新挂载也会安装刷新定时器，不再因提前返回而失去自动更新。请求进行中不会重复启动同一 Hook 的刷新；换赛季、轮次、禁用和卸载时取消旧请求与定时器。
- 来源失败时保留并标记旧数据，后续仍会自动尝试；不会把更新失败或空响应当成新成绩覆盖已有榜单。
- DHL 目录、上游原始响应及 API 实例内缓存均缩短为 60 秒；浏览器与 CDN 响应均 `no-store`，移除原先可能长期返回旧结果的边缘缓存策略。客户端 API 也明确绕过 HTTP 缓存。
- 进站 API 客户端在需要取数时按需加载，保持比赛结果静态依赖在性能预算内。
- 原有跨赛季取消请求、迟到响应不覆盖及赛季最快记录保留测试继续保留。新增 5 个自动刷新场景，当前 Hook 文件共 6 项通过；新增服务端短缓存、旧数据回退和恢复测试。
- 浏览器实际推进虚拟时钟 15 分钟，分别验证赛季积分 559 → 584、赛季最快换胎 1.89 → 1.88 秒、单站最快进站 2.16 → 2.10 秒，未刷新网页或手动重试。
- 最终全量 Vitest：937 项通过；接口/部署检查 30 项通过；最终生产构建的进站与通用路由浏览器验证 43 项通过、8 项按既有规则跳过。桌面、手机、平板均覆盖。构建、严格 lint、UTF-8 和性能预算通过。

这里保证的是自动检查与更新机制已经实现并验证，不保证 DHL 在比赛结束后立即发布数据，也不保证外部接口永不变化。页面无人访问时无需后台任务；下次进入会读取来源。用户固定选择的历史赛季或轮次不会被自动改成另一场。新机制尚未部署，线上版本不会因本地修改而自动改变。
# Release regression follow-up

The complete release matrix caught a loss of the existing left/right corner split in the shared weekend panel. The panel now shows the total and preserves a known split (`20 · 11L / 9R` at COTA; `11 · 4L / 7R` at Monza), with a total-only fallback when no reliable split exists. The unchanged Monza regression and strengthened COTA assertion passed together with weather/history checks: 27 tests across desktop, mobile and tablet Chromium. Strict lint, type checking, production build and unchanged performance budgets passed after the repair. Final protected CI evidence is attached to release PR #91.
