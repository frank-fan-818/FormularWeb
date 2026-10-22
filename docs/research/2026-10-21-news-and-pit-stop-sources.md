# 新闻与进站数据来源实测

日期：2026-10-21（Asia/Shanghai）。本报告记录本轮匿名、只读 HTTP GET 实测，不代表上游长期可用性承诺。没有创建自动任务、导入数据库或修改网站功能。

## 建议采用的来源

- 新闻：RSS 作为自动获取渠道，优先评估 Autosport、Motorsport 英文 F1 feed，FIA 公告作为补充；BBC 作为另一候选。技术可读与取得展示、翻译、图片使用权分别判断。
- 社交：Reddit 正式 API 获批后自动发现候选帖子；首版可先维护精选 URL 和本站导读，按需要使用官方嵌入。没有实测获授权的 Reddit API 会话，不能称其自动采集已可用。
- 维修区总用时：Jolpica 主源，F1DB 历史补充 / 离线快照，F1 官方结果页和 FIA 原始结果文档用于核对。
- 静止换胎用时：OpenF1 补较新赛事；DHL 官方 JSON 提供历年最快榜单，但已测单站只有 10 条，不能当作全量记录。
- DHL 官方排名：已找到官网实际使用、无需登录的 JSON 读取端点，适合建设服务端采集适配器；它是未文档化的网站接口，不是带版本或 SLA 保证的开放 API。

## 新闻：实际可获取的地址

| 来源 | 本轮读取地址 | 实测结果 | 角色与限制 |
| --- | --- | --- | --- |
| Autosport F1 | `https://www.autosport.com/rss/f1/news/` | HTTP 200，XML，50 条 | 专业 F1 新闻候选主源 |
| Motorsport F1 英文 | `https://www.motorsport.com/rss/f1/news/` | HTTP 200，XML，50 条 | 另一候选主源；与 Autosport 存在报道重叠 |
| BBC F1 | `https://feeds.bbci.co.uk/sport/formula1/rss.xml` | HTTP 200，XML，64 条 | 候选补充源；商业使用 RSS 需要 BBC 许可 |
| FIA News | `https://www.fia.com/rss/news` | HTTP 200，RSS XML，10 条 | 所有 FIA 新闻，不是纯 F1；需要分类筛选 |
| FIA Press releases | `https://www.fia.com/rss/press-release` | HTTP 200，RSS XML，10 条 | 官方公告补充；不是纯 F1，feed 窗口较短 |
| RaceFans | `https://www.racefans.net/feed/` | HTTP 200，但 Content-Type 是 HTML，XML 解析失败 | 暂不作为主源；不能仅凭 200 判定成功 |
| Motorsport 中文 | `https://cn.motorsport.com/rss/f1/news/` | HTTP 403 | 本环境未验证出稳定的中文 RSS；不绕过访问限制 |

Autosport 实测 item 字段：`title`、`link`、`description`、多个 `category`、`guid`、`pubDate`、`enclosure`。这足以生成新闻索引，不需要先抓取完整文章正文。

FIA 的真实 RSS 地址来自其官方 [RSS 说明页](https://www.fia.com/media-center/rss-feed)，而不是此前笼统引用的 `/media-center` 路径；后者本轮返回 404。

### 如何进入本站

1. 后台定时任务每 30–60 分钟读取已确认使用范围的 feed，设置超时与来源级失败隔离。此周期是建议，不是已创建任务。
2. 检查响应类型与 RSS 根节点，按 GUID / 规范化原文 URL 去重，提取来源、标题、发布时间、链接与获准使用的简介。
3. 按 F1 分类筛选、校验发布时间，保存 Supabase；记录首次收录时间，不能用它替代原文发布时间。
4. 前端只读取本站数据，显示来源与更新时间；单个上游失败不拖慢用户打开页面。
5. 来源支持 ETag / Last-Modified 时做条件请求，尊重 feed 更新提示，不要求上游为每个访问者重复服务。
6. 对只开放最近 10 条的 FIA feed，定时入库可积累后续历史；不能承诺仅靠该 feed 回补过去全部新闻。

首版可显示原始标题与原文入口。中文标题、自动导读和图片分别根据来源使用条件决定；RSS 可订阅不等于全文、翻译、图片可自由再发布。不能把任意英文源统一送模型翻译后默认允许上线。

### 其他获取方式

- [Guardian Open Platform](https://open-platform.theguardian.com/access/) 有正式内容 API。需要注册 key，非商业 Developer 层目前为 1 请求/秒、500 请求/天，商业使用应申请相应方案。尚未取得 key，也未实测本站 API 集成。
- 国内门户和中文媒体仍需逐个确认公开接口或合作方式；本轮没有验证出可直接采用的稳定中文自动源。
- Reddit 自动发现建议使用获批的 Data API，获取 r/formula1 等社区的帖子元数据；不使用公开 `.json` 或 RSS 绕过批准要求。[官方访问说明](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data)。

### 新闻使用条件的核查状态

- Autosport / Motorsport 官方均有 RSS 目录，说明提供阅读订阅服务；本轮其 `/info/terms-of-use/` 返回 403，没有确认本站商业展示或自动翻译许可。作为技术候选，不写成已授权发布源。
- BBC [条款第 15 节](https://www.bbc.co.uk/usingthebbc/terms-of-use/#15metadataandrssfeeds) 对 RSS / 元数据和商业使用分别作出规定；不要将“免费读取”写成“商业免费”。
- FIA RSS 说明确认了获取渠道，但没有替本站解决内容与图片的再使用范围。
- [F1 官网 RSS 条款](https://www.formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt) 限制纯聚合、商业聚合及修改 / 翻译，故不作为默认的中文聚合源。

## 进站记录：扩展到多种来源

> 站内阅读补充（2026-10-21）：后续实测 Motorsport RSS 的前三条 description 去除标签后约 394、407、413 个字符，没有 `content:encoded` 正文字段；它不能支撑完整文章阅读。FIA Press releases 的 description 可能有数千字符，但不能因 feed 提供正文就推定获得转载权。FIA 网站条款 3.5 限制未经书面同意的内容复制 / 分发，3.6 对注明出处的短摘录作有限说明，3.7 限制 framing / 将内容嵌入其他网站。技术上的站内详情页、来源标注与内容再使用许可须分别处理。用户已选择先做站内简短导读并保留原文链接；本地现已实现来源 RSS 的纯文本短节选（最多 280 个 Unicode 字符、40 个空格分隔词），标注来源与发布时间，保留原文语言和独立原文入口，不抓取全文或嵌入外站。此实现不等于已取得全文转载许可或完成公网发布。

> 若选正式供稿 API，[Guardian Open Platform](https://open-platform.theguardian.com/access/) 可提供文章正文，需要 API key；非商业 Developer 与 Commercial 方案分开，不能将开发层自动用于商业产品。是否适合本站仍需按实际使用范围与许可审定，不以注册 key 自动证明全部使用方式获准。

| 来源 | 适合的数据 | 覆盖与本轮证据 | 定位 |
| --- | --- | --- | --- |
| Jolpica | 车手、圈数、进站顺序、维修区总用时 | 文档从 2011 年起；2025 巴林站实测 42 条 | 常规主源，使用现有同源代理 |
| F1DB | 历史车手 / 车队、圈数、进站顺序、用时 | 本地快照有 1994 年起的部分赛事；远端 1994 太平洋站实测 41 条 | 扩展 2011 年之前历史，保存发布版本 |
| OpenF1 | `lane_duration`、`stop_duration`、圈数和车号 | 文档的历史数据从 2023 年起；静止用时从 2024 美国站起；2025 墨西哥样本成功 | 较新赛事的总用时 / 静止用时补充 |
| DHL JSON | 官方最快进站成绩、积分、年度排名 | 2018、2024、2025、2026 样本均成功；单站已测均 10 条 | 官方榜单，不是全场进站明细 |
| F1 官方结果页 | Pit Stop Summary、每次及累计维修区用时 | 2025 巴林站 HTTP 200，HTML 表格 42 行 | 原始结果核对 / 备用解析 |
| FIA Race Pit Stop Summary PDF | 官方逐次进站与累计用时 | 已找到 2025 巴林站原始 PDF，与网页样本吻合 | 核对入口；本轮未实现 PDF 解析器 |
| FastF1 | PitInTime / PitOutTime、轮胎、进站圈上下文 | 项目已有导出链路，但尚未输出进站明细 | 可后续推导维修区区间，不能把两个时间相减称作静止换胎用时 |

### 已核对的同场记录

- [Jolpica：2025 巴林站](https://api.jolpi.ca/ergast/f1/2025/4/pitstops/?limit=100)：`total=42`，本页返回 42 条。
- [F1DB：2025 巴林站 YAML](https://raw.githubusercontent.com/f1db/f1db/main/src/data/seasons/2025/races/04-bahrain/pit-stops.yml)：42 条，前 3 个用时为 24.229、25.265、24.876 秒。
- [F1 官方：2025 巴林站](https://www.formula1.com/en/results/2025/races/1257/bahrain/pit-stop-summary)：42 条；抽查前两条分别是第 5 圈 Hülkenberg 24.229 秒、第 6 圈 Hadjar 25.265 秒，与 Jolpica / F1DB 一致。
- [FIA 官方结果 PDF](https://www.fia.com/sites/default/files/2025_04_brn_f1_r0_timing_racepitstopsummary_v01.pdf)：可作进一步逐行核对的原始来源。

上述为数量与少量记录交叉检查，没有声明已经逐条比对全部车手，也不能将多个来源一致视为它们具有独立采集来源。

### F1DB 的额外价值与边界

- 项目已经存在 `f1db-main/` 本地目录，并在回测脚本中读取过 `pit-stops.yml`，可复用历史资料与 ID 映射经验。
- 本地快照：1994 年有 15 场、476 条，2010 年 19 场、592 条，2025 年 24 场、769 条；1994 年不是完整赛季覆盖。统计了非空 time 字段，但没有对每个时间值完成数值 / 语义质量审计。
- 本地 2026 年仅有 2 场、49 条，明显不足以服务当前赛季，不能当作最新版。
- 远端 [1994 太平洋站样本](https://raw.githubusercontent.com/f1db/f1db/main/src/data/seasons/1994/races/02-pacific/pit-stops.yml) HTTP 200，41 条；[2010 巴林样本](https://raw.githubusercontent.com/f1db/f1db/main/src/data/seasons/2010/races/01-bahrain/pit-stops.yml) 也成功。
- 本轮读取 [latest release](https://api.github.com/repos/f1db/f1db/releases/latest) 为 `v2026.17.0`，发布时间 `2026-10-11T17:18:30Z`。有 JSON / CSV / SQL 及 SHA-256 校验文件，适合固定 release 下载、验证后入库，避免生产依赖随时变化的 main。
- [F1DB](https://github.com/f1db/f1db) 声明 CC BY 4.0，使用时保留来源、版本、许可及修改说明。数据中 `time` 不能因为名称简短就解释为静止换胎用时；历史加油等时期也不能与现代换胎成绩直接比较。

OpenF1 [实际读取样本](https://api.openf1.org/v1/pit?session_key=9877&driver_number=16) 返回：第 31 圈，`lane_duration=22.215` 秒，`stop_duration=2.2` 秒。两个指标明显不同；`pit_duration` 是前者的弃用别名，不应作为新契约字段。[文档](https://openf1.org/docs/)。

## DHL：已经找到的官方 JSON

发现方式：读取 [当季官方页面](https://inmotion.dhl/en/formula-1/fastest-pit-stop-award) 的 `.f1-award-element` 区块，提取 `data-url`、`data-type` 和 `data-statistic`。官网 JavaScript 初始化时读取这些地址；切换分站使用 `event` 参数。

| 用途 | 本轮发现的实际地址 | 已验证的返回结构 |
| --- | --- | --- |
| 当季单站最快记录 | `https://inmotion.dhl/api/f1-award-element-data/7373` | `data.chart[]`、`data.event_id` |
| 2026 澳大利亚站 | `https://inmotion.dhl/api/f1-award-element-data/7373?event=1167` | `event_id=1167`，10 条 |
| 当季年度积分 / 赛季最快 | `https://inmotion.dhl/api/f1-award-element-data/7374` | `data.chart.standings[]` 11 条、`season_fastest[]` 10 条 |
| 当季车队每站均值 | `https://inmotion.dhl/api/f1-award-element-data/7375` | `data.chart.events[]`、`values[]`；含未来赛事 / 空用时，必须过滤 |
| 2025 单站 / 年度 | `https://inmotion.dhl/api/f1-award-element-data/6365`、`6366` | 末站 10 条；年度 10 支车队 |
| 2024 单站 / 年度 | `https://inmotion.dhl/api/f1-award-element-data/6273`、`6275` | 末站 10 条；年度 10 支车队 |
| 2024 巴林站 | `https://inmotion.dhl/api/f1-award-element-data/6273?event=1016` | 10 条，返回正确 event_id |
| 2018 单站 / 年度归档组件 | `https://inmotion.dhl/api/f1-award-element-data/7613`、`7612` | 末站 10 条；年度 10 支车队 |
| 2018 澳大利亚站 | `https://inmotion.dhl/api/f1-award-element-data/7613?event=92` | 10 条；旧数据 lap 可为 null |

单站字段实测：`id`、`driverNr`、`tla`、`firstName`、`lastName`、`team`、`duration`、`startTime`、`lap`、`points`、`irregular`、`notes`。

使用事实与限制：

- 所有上表已测试地址均匿名 HTTP 200，JSON 可解析，无需本站持有 API key 或模拟登录。
- 年度积分接口在本轮两次生成的 chart 规范化 SHA-256 一致：`72a38104e4da00f625afe162e94b26a0d2535ae22d3f3b61eeb489ba1fffb8ea`。仅说明短时间复测一致，不代表跨日、跨赛季稳定性已经证实。
- [历史总览](https://inmotion.dhl/en/formula-1/fastest-pit-stop-award/overview) 有 2018—2025 的组件与分站选择器，选项数依次为 21、21、17、22、22、22、24、24；没有逐个请求全部历史分站，因此不能承诺选项都已有完整数据。
- 当季选择器有 23 个选项，包含尚未比赛的场次；未发布分站可以 HTTP 200 但返回空数据，不能当作同步成功后的零成绩。
- `event_id` 是 DHL 内部 ID，不等于比赛轮次；必须从官网选项、日期及赛道信息匹配。不能按 1、2、3 推测 ID。
- 不要写死上述 7373 等 CMS 元素 ID。每次刷新先发现官网区块实际 `data-url`，并校验 `data-type=pit_stop` 与统计类别；历史页面也有不同 ID。
- 单站保留官方原始积分与异常标识，不自行套用旧计分说明、不按车队去重，不假定同队只有一条记录可以得分。
- `lap` / `notes` 在旧数据可为 null；`startTime` 需进一步核对真实时区语义，不直接拿它当用户本地时间发布。
- JSON 还附带 `htmlList`；本站只解析所需数据，不执行返回的 HTML / 脚本。
- 官网 footer 给出的 `/terms-of-use` 本轮返回 404；本轮没有确认对外再发布授权，技术可读与使用权仍分开处理。

### 建议如何做成可靠的本站数据源

1. 定时采集而非浏览器直连：官网发现组件 → 拉取 JSON → 校验赛季 / 赛事 / 字段 → 保存来源快照 → 原子发布成功版本。
2. 保留最近成功快照、抓取时间、赛事截止范围与解析版本；返回空数据或 schema 变化时不清空旧榜单。
3. 对比官网展示表格与 JSON 的行数、车队名、用时和积分；处理当季车队数变化，不能永远写死 10 支。
4. 发布后的重试低频进行，采用退避与请求超时；历史赛季回补限速、固定快照，避免每次访问重复抓取。
5. 发生变更时展示“更新暂缓”和数据截至时间，并保留 DHL 原始入口；不能把 OpenF1 算出来的排序静默替换成 DHL 官方积分。

当前结论：已找到实际可用、跨多个赛季样本一致的网站数据接口，可以推进采集器的契约设计；仍不能声称它是具有官方对外服务承诺、已获再发布许可的稳定开放 API。
