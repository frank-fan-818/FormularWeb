# 搜索补充车手逐条核验与入库记录

日期：2026-10-18（Asia/Shanghai）。范围：上次搜索审计中仅在 Jolpica 找到的 15 条车手记录。

## 已完成的数据库变更

- 新增 `drivers` 15 条，车手总数从 916 变为 931。
- 新增 `driver_history_summary` 15 条，包含身份、参赛性质、核验来源与备注。
- 使用数据库实际字段生成插入数据；基础车手表没有 `url` 列，来源链接保存在档案摘要中。
- 仅插入缺失记录，没有更新、删除已有车手，也没有写入比赛结果、排位成绩或积分榜。
- 写入后逐字段读回验证；另外使用浏览器 anon 权限验证了 15 条基础资料与摘要均可读取。
- 再次运行只读导入计划，待插入车手及摘要均为 0，确认重复执行不会重复入库。

核验指确认人物身份和 F1 关联，同时区分已确定字段与仍有争议的字段；不把上游出现一条记录等同于曾参加正赛。

## 逐条结论

所有人物另与 Jolpica 的车手及结果端点交叉核对，具体端点保存在清单中。
13 位历史车手的上游结果均为退赛报名记录，`laps=0`；两位现代测试/储备车手的正赛结果端点为空。
这些结果中的列表排序位置不是实际完赛名次，没有导入。

| 新数据库 ID / 姓名 | 生日 | 参赛性质与入库处理 | 主要核验来源 |
| --- | --- | --- | --- |
| `carlo_abate` / Carlo Abate | 1932-07-10 | 1962–1963 年报名，正赛出场 0；报名次数采用 STATS F1 的 3 次，Jolpica 仅返回其中 2 条，不补造第三场成绩 | [STATS F1](https://www.statsf1.com/en/carlo-abate.aspx) |
| `alex_blignaut` / Alex Blignaut | 1932-11-30 | 1965 南非站报名；正赛出场 0，报名 1 次 | [STATS F1](https://www.statsf1.com/en/alex-blignaut.aspx) |
| `menato_boffa` / Menato Boffa | 1930-01-04 | 1961 意大利站报名；正赛出场 0，报名 1 次；资料亦有 Mennato 拼写 | [STATS F1](https://www.statsf1.com/en/mennato-boffa.aspx)、[ACI Napoli 的纪念资料](https://napoli.aci.it/fileadmin/Documenti/ac_napoli/Mondoauto/luglio_2022/MONDOAUTO-web-luglio.pdf) |
| `david_clapham` / David Clapham | NULL | 1965 南非站报名；正赛出场 0，报名 1 次；生日有 1931-05-17 / 18 两种记载，暂不选定 | [STATS F1](https://www.statsf1.com/en/dave-clapham.aspx)、[对照资料](https://en.wikipedia.org/wiki/David_Clapham) |
| `geoff_duke` / Geoff Duke | 1923-03-29 | 1961 德国站报名；正赛出场 0，报名 1 次 | [STATS F1](https://www.statsf1.com/en/geoff-duke.aspx) |
| `leonardo_fornaroli` / Leonardo Fornaroli | 2004-12-03 | 2026 McLaren 测试/储备车手；核验时无 F1 世界锦标赛正赛出场记录，报名次数记 0，不把 F2/F3 冠军写入 F1 冠军数 | [官方 F3 身份资料](https://www.fiaformula3.com/en/latest/article/in-profile-leonardo-fornaroli.41m3gVN6N8Zek7FxLF1Sp)、[F1 官方角色采访](https://www.formula1.com/en/latest/article/exclusive-fornaroli-on-testing-with-mclaren-the-different-world-of-f1-and-pushing-for-a-full-time-seat.4Ppi0w2M4hSaKdhGHldkBQ.4Ppi0w2M4hSaKdhGHldkBQ) |
| `colton_herta` / Colton Herta | 2000-03-30 | 2026 Cadillac 测试车手；核验时无 F1 世界锦标赛正赛出场记录，报名次数记 0；测试及练习赛不算正赛 | [官方 F2 档案](https://www.fiaformula2.com/en/drivers/colton-herta)、[Cadillac 官方任命](https://news.cadillac.com/newsroom.detail.html/Pages/news/us/en/2025/sep/0903-Cadillac-Formula-1-Team-Colton-Herta-Test-Driver.html) |
| `gary_hocking` / Gary Hocking | 1937-09-30 | 1962 南非站报名；正赛出场 0，报名 1 次；保留历史参赛国籍 Rhodesian | [STATS F1](https://www.statsf1.com/en/gary-hocking.aspx) |
| `ken_miles` / Ken Miles | 1918-11-01 | 1961 美国站报名；正赛出场 0，报名 1 次 | [STATS F1](https://www.statsf1.com/en/ken-miles.aspx) |
| `thomas_monarch` / Thomas Monarch | NULL | 仅收录可核对的 1963 墨西哥站报名身份；正赛出场 0，报名 1 次；人物传记与生日存在冲突，不导入上游生日或推测性故事 | [STATS F1 报名记录](https://www.statsf1.com/en/thomas-monarch/palmares-gp-mexico.aspx)、[赛事记录](https://autosportworld.info/en/f1/seasons/1963/mexico/)、[存在不同生平记载的 Wikidata](https://www.wikidata.org/wiki/Q3544896) |
| `peter_monteverdi` / Peter Monteverdi | 1934-06-07 | 1961 德国站报名；正赛出场 0，报名 1 次 | [STATS F1](https://www.statsf1.com/en/peter-monteverdi.aspx) |
| `ray_reed` / Ray Reed | 1932-04-30 | 1965 南非站报名；正赛出场 0，报名 1 次；参赛国籍采用 Rhodesian，未照搬 Jolpica 的 South African | [STATS F1](https://www.statsf1.com/en/ray-reed.aspx) |
| `rob_slotemaker` / Rob Slotemaker | 1929-06-13 | 1962 荷兰站报名；正赛出场 0，报名 1 次 | [STATS F1](https://www.statsf1.com/en/rob-slotemaker.aspx) |
| `ernie_de_vos` / Ernie De Vos | 1941-07-01 | 1963 美国站报名；正赛出场 0，报名 1 次；采用加拿大参赛国籍，而非照搬出生地对应的 Dutch | [STATS F1](https://www.statsf1.com/en/ernie-devos.aspx) |
| `syd_van_der_vyver` / Syd Van der Vyver | 1920-06-01 | 1962 南非站报名；正赛出场 0，报名 1 次 | [STATS F1](https://www.statsf1.com/en/syd-van-der-vyver.aspx) |

不为这些人物编造永久车号、三字母计时代码、完赛名次、冠军赛季或积分。字段未知时保留 NULL。
姓名采用便于与已有上游记录对应的常用写法，数据库 ID 使用项目的下划线命名。

## 档案契约与维护

没有新增数据库列或端点。以下为 `driver_history_summary.career_summary` JSONB 的可选扩展，
正常已有车手档案继续使用原来的成绩契约。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `entryCount` | 非负整数 | 已核验的世界锦标赛报名次数，与正赛出场分开 |
| `participationStatus` | `entered_without_start` / `test_reserve` | 报名但未出场，或测试/储备身份 |
| `participationNote` | 非空字符串 | 已核验事实说明 |
| `verificationSources` | HTTPS URL 数组 | 核验依据 |
| `verifiedAt` | 日期字符串 | 本次核验日期 |
| `verificationNotes` | 字符串 | 来源分歧、未知字段及采用口径 |

只有明确带核验信息、所有 F1 成绩为 0、没有赛季成绩和最佳完赛结果的档案，才能使用零出场路径。
普通缺失或损坏的空摘要仍会回退到原有查询，不能因本次补录放松所有数据校验。

`DriverDetail` 是 `/drivers/:id` 和 `/history/drivers/:id` 实际共用的页面。
历史概览明确标注“仅报名，未参加正赛”或“测试／储备车手”，展示报名次数、正赛出场 0 和准确的空赛季说明。
`backfill-history-summaries.ts` 和 `audit-and-backfill-derived-data.ts` 在重新聚合空历史时保留核验信息；
如以后有真实成绩，则由成绩聚合结果取代零出场状态。

清单：`data/reference/verified-driver-additions.json`。新增脚本默认只读预览：

```text
node --import tsx scripts/backfill-verified-search-drivers.ts
node --import tsx scripts/backfill-verified-search-drivers.ts --apply
```

写入只使用本地环境中的服务端凭据，脚本拒绝服务器与浏览器项目 URL 不一致的配置；不把凭据写入清单或报告。

## 验证证据

- 数据库匿名读取：931 条车手；15 条新增档案均可映射为完整资料，生日与国籍符合核验清单。
- 与审计的 881 条 Jolpica 车手合并后仍是 931 条；未匹配到数据库的上游记录为 0，同名重复为 0。
- 逐条全名查询：15 位各一条结果，均指向自己的数据库 ID。
- 导入脚本重复只读执行：新增车手 0，新增摘要 0。
- `npm test`：83 个文件、499 项通过。
- `npm run build`：TypeScript 与生产构建通过；原有 logger 静态/动态导入提示仍在。
- 相关 TypeScript/TSX/E2E 文件 ESLint 零警告通过；UTF-8 编码检查与 `git diff --check` 通过。
- 两条历史数据维护脚本的 `--help` 入口通过，未运行其全库写入操作。

Browser QA 日期：2026-10-18。分支：`codex/points-completed-race-alignment`。本地生产构建 URL：`http://127.0.0.1:4173`。
尺寸：1440×900、375×812。新增用例逐一执行 15 位车手的搜索到详情页流程，校验报名与出场分开、未知生日不回填、无横向溢出、无额外生涯查询、无控制台错误及非导航取消的失败请求。
另回归首页、赛事、比赛、已有车手、车队、赛道、账号页、设置及 404，以及既有四类搜索导航和 v5 缓存升级用例。
最终结果：27 项通过，5 项按已有策略跳过；新增 15 人的完整流程在两个尺寸均实际执行。Blocking：无。

本地证据位于 Git 忽略的 `artifacts/search-audit/`：

- `verified-driver-import-receipt.json`：实际插入与逐字段读回记录。
- `verified-driver-final-check.json`：匿名权限、身份合并和逐条搜索结果。
- `missing-driver-results.json`：逐条上游结果及退赛状态。
- `archive-desktop.png`、`archive-mobile.png`、`test-driver-desktop.png`、`test-driver-mobile.png`：两类档案的桌面与手机截图。

数据库补录已生效；本轮页面与维护脚本改动仍在本地，尚未部署。
