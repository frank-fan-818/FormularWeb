# 赛道参数补全

核查日期：2026-10-26。本轮仅修改本地源码，未提交或部署。

## 数据与显示规则

- `src/data/circuit-profiles.json` 覆盖仓库 F1DB 目录中的全部 78 条赛道，供列表和详情共用。包含名称、位置、赛道长度、弯道数量、方向、首次举办世界锦标赛年份、历史场次、正赛圈数和距离。
- 基础来源：[F1DB](https://github.com/f1db/f1db)，CC BY 4.0；本地参考目录 `f1db-main/src/data/`。快照取截至 2025 年的完整赛季，参数采用该赛道最后一次 F1 比赛的布局及已发布的计划距离，不以比赛距离除以圈数推算单圈长度。历史场次包含同年在同一赛道举行的不同大奖赛，不包含非锦标赛。
- 马德里采用 [F1 2026 西班牙站](https://www.formula1.com/en/racing/2026/spain) 已发布的 5.414 km、22 弯、57 圈、308.399 km、2026 首赛和已举行一场资料，覆盖旧设计方案。
- 运行时仍优先使用远端有效字段；远端空值、占位文本或读取失败时逐字段使用本地快照。快照历史次数截至 2025，马德里单独更新至 2026；这不是实时生涯统计服务。
- 赛道原有单圈纪录字段继续保留，本轮未全面重算不同历史布局的单圈纪录。
- 统一别名匹配覆盖本季赛历，以及 Boavista、Charade、Essarts、Gálvez、George、Le Mans、Okayama、Tremblant 等历史 API ID。保留不同地点的独立身份，例如 Madring / Catalunya、Las Vegas Strip / Caesars Palace。
- `0` 是有效数据，不能以真假值判断为缺失。远端的 `--`、`N/A`、`unknown`、`资料待补` 等不覆盖本地已知值。
- 本地资料同步进入首屏，慢速远端请求不阻塞已知参数。全部 78 条赛道均有基础参数；历史赛道未有可靠来源的左右弯分布、高差为可选参数，不渲染占位卡片，也不填猜测数字。当前赛历的工程参数均有本地资料。

## 新增工程参数来源

| 赛道 | 补全值 | 来源 |
| --- | --- | --- |
| Sepang | 5 左 / 10 右，22 m，顺时针 | [F1 马来西亚站统计](https://www.formula1.com/en/latest/article/vital-statistics-the-malaysian-grand-prix.7KJRxZH1EAYZJAdPUZBEz.7KJRxZH1EAYZJAdPUZBEz)、[F1 高差对比](https://www.formula1.com/en/latest/article/highs-and-lows-which-f1-track-has-the-most-elevation-changes-.7I9JEcBw3R2AqXbnJ6hyvc.7I9JEcBw3R2AqXbnJ6hyvc) |
| Madring | 10 左 / 12 右，26 m，顺时针 | [赛道技术资料](https://www.madring.com/en/circuit)最高点 697 m、最低点 671 m，相减为 26 m；[Reuters 赛前统计的转载](https://www.straitstimes.com/sport/formula-one/formula-one-statistics-for-the-spanish-grand-prix2)核对左右弯数量。弯道倾角不作为全程高差。 |
| Sochi | 6 左 / 12 右，1.9 m，顺时针 | [F1 俄罗斯站预览](https://www.formula1.com/en/latest/article/russia-preview-f1-drivers-keen-to-tackle-awesome-sochi.7wUjPFGqA4x55sB2RPumZQ)、上述 F1 高差对比 |
| Mugello | 6 左 / 9 右，41 m，顺时针 | [赛道官方手册](https://www.mugellocircuit.it/images/stories/pdf/mugello_circuit_brochure_platinum_2811.pdf)、[Bridgestone 赛道手册存档](https://mototribu.com/competition/motogp/2015/course/006italie/doc/magazine_bridgestone_italie_mugello_motogp_2015.pdf) |
| Portimão | 6 左 / 9 右，高差显示“不足 30 m”，顺时针 | [Mercedes 对高差的技术说明](https://www.mercedesamgf1.com/news/the-impact-of-track-elevation-in-f1)、F1DB 布局。保留来源的近似表述，不生成虚假精确值。 |

同时校正部分原有左右弯记录，使左右弯之和与基础弯道数量一致。迈阿密依据 [FIA 2026 官方媒体资料](https://www.fia.com/sites/default/files/final_2026_media_kit.pdf)的 12 左 / 7 右；铃鹿依据 [Pirelli / F1 2023 说明](https://www.formula1.com/en/latest/article/what-tyres-will-the-teams-and-drivers-have-for-the-2023-japanese-grand-prix.4AG2oXMnZ3lk57gxUrUKKD)的 8 左 / 10 右；拉斯维加斯依据 [F1 2023 官方赛事手册](https://media.formula1.com/image/upload/v1700208575/F1-Race-Programme-Las-Vegas-2023.pdf)的 11 左 / 6 右；Yas Marina 依据 [赛道官方布局手册](https://static.myconnect.ae/-/media/yasconnect/project/ymc/track-hire-detail-page/brochure/ymc-track-rate-card.pdf)的 9 左 / 7 右。

## 更新方法

运行 `node scripts/generate-circuit-profiles.mjs [F1DB/src/data目录]`，检查快照差异并核对新增赛道及布局变化，再运行赛道单元测试、构建和 `e2e/circuit-metadata.qa.spec.ts`。不要把未举行的赛历条目计为已举办场次。
