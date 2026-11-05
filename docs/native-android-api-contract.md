# Android 数据与账号接入契约

## 第一条使用路径

赛事 → 赛季赛历 → 比赛周末 → 正赛 / 排位成绩。继续使用网站相同的 Jolpica 数据来源；原生网络层独立于浏览器地址、Vite 代理和 DOM。

- 上游基础 URL：`https://api.jolpi.ca/ergast/f1/`。
- 公共赛事请求均为 HTTPS GET，显式设置 `User-Agent: FrankPitwall-Android/{原生版本}`。
- 不使用客户端秘密或 Supabase service-role key。构建准备脚本仅提取 Web 配置中的公开 URL、anon/publishable key 和验证码 site key，写入被忽略的 `backend.public.properties`；APK 不读取 `.env`。
- 公开缓存与会员请求分离。会员、私有遥测、天气和预测不经过公开缓存层。

| 能力 | 路径 | 数据 |
|---|---|---|
| 赛历 | `{season}.json?limit=100` | `MRData.RaceTable.Races` |
| 正赛 | `{season}/{round}/results.json?limit=100` | 第一场赛事的 `Results` |
| 排位 | `{season}/{round}/qualifying.json?limit=100` | `QualifyingResults` |
| 冲刺 | `{season}/{round}/sprint.json?limit=100` | `SprintResults`，仅在有场次时请求 |
| 车手积分 | `{season}/driverStandings.json?limit=100` | `MRData.StandingsTable.StandingsLists[0].DriverStandings` |
| 车队积分 | `{season}/constructorStandings.json?limit=100` | `ConstructorStandings` |

## 数据与失败语义

- 响应根对象、日期、赛季与轮次必须有效；检查 total 与条目数量，不把分页缺失当完整赛历。
- 赛季与轮次、车手标识不得重复；保留官方名次、积分及状态，不自行重算历史积分。
- 时间未知时保留 null，只显示已知日期；不能将未知时间伪装为午夜。
- 正赛使用官方总时间、差距或状态；排位按 Q3 / Q2 / Q1 最近有效阶段展示。退赛、未分类和无数据分别处理。
- 无比赛 / 无成绩返回空集合；HTTP 错误、无效 JSON 和不完整列表返回失败，不能静默转为空列表。
- 取消的请求不得覆盖后来选中的赛季、轮次或场次。
- 网络调用有连接和读取超时；429 不立即重试；不在后台轮询或自动调用私有接口。
- 公开缓存按赛季、分站和场次隔离，带获取时间；缓存回退需明确显示更新时间，不用模拟数据冒充真实返回。

## 访问依据与后续边界

[Jolpica 官方文档](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md)列明端点、limit 最大 100、响应 total 和自定义 User-Agent 要求。[限流说明](https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md)列明匿名访问及缓存建议。实时可达性与原生运行结果须另行记录，不因文档存在而视作已接通。

首个纵向切片优先使用平台 HTTPS 与 JSON 能力，减少初始依赖；如后续接口和传输需求扩展，再引入原计划中的 Retrofit / 序列化组合。客户端所有请求仍封装在原生 `data/`，不把网络代码放入 Compose 页面。

## 0.2 功能扩展

- 历史资料分页读取 Jolpica `drivers / constructors / circuits`；显示加载数及总数，允许加载完整目录后搜索。
- 生涯汇总读取公开 `driver_history_summary / constructor_history_summary`；逐年进入 Jolpica 分站成绩。赛道往届使用 `circuits/{id}/races.json`，不能将赛道资料端点当作比赛列表。
- 练习赛与冲刺排位读取公开 `race_session_results`；2023 冲刺排位优先 SS，其余优先 SQ。未发布明确显示为空，不生成示例成绩。
- 新闻使用网站三个 `/news-feed/*` 代理，原生解析 RSS/Atom。拒绝 XML 实体声明，文章链接只允许对应来源的 HTTPS 主机。
- DHL 榜与本场进站读取 `/api/pit-stops`，分别呈现维修区通过与停车换胎耗时。
- FIA 升级优先公开 `fia_race_upgrade_snapshots`，兼容 `fia_car_upgrades`。
- 会员分析使用 `/storage/v1/object/authenticated/fastf1-private/{season}/{round}/{session}.json`，缺少对象时回退会员表 `fastf1_session_analytics`。遥测使用 `-telemetry.json`。
- 预测读取会员 `race_prediction_current`，天气读取带 Bearer 的 `/api/race-weather`。
- 所有会员响应在完整读取和解析之后再次检查账号 ID 与会话 generation；切换账号、退出或取消后不得写回旧数据。

## 账号与验证

使用现有 Supabase Auth REST 邮箱登录、注册、找回密码、刷新与当前设备退出。验证码使用 SDK 对应的 `gotrue_meta_security.captcha_token` 契约，保留服务端验证和 RLS。

账号字段、导航、数据页面和图表均为 Compose。现有 Turnstile 仅在独立受限 WebView 中加载，遵循 [Cloudflare 原生移动应用接入说明](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/)；它不接收邮箱、密码或会话令牌，关闭文件/内容访问及混合内容，限制网络来源。邮件确认和密码重置使用网站已允许的重定向，完成后回到应用登录。

会话通过 AndroidKeyStore AES-256-GCM 加密保存到禁止备份目录；密码不持久化。恢复与刷新后使用 `/auth/v1/user` 验证身份，不能仅凭本地文件授予会员访问。
