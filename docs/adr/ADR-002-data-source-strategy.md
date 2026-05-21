## ADR-002：数据源策略 — Ergast/Jolpica API + Supabase 双层缓存

- **背景**：F1 数据来源有两个渠道：(1) Jolpica API（Ergast 兼容格式），提供实时/历史赛事数据；(2) Supabase Postgres，可存储本地缓存和增强数据。需要决策数据获取的优先级和缓存策略。
- **选项**：
  - A：**纯 Jolpica API** — 优点：简单，无数据库维护成本。缺点：每次请求都走外网、受限于 API rate limit、离线不可用、无法存储自定义增强数据（如 FastF1 分析、FIA 升级）
  - B：**Jolpica + Supabase 双层** — 优点：Supabase 作为本地缓存减少外部 API 调用（更快、更可靠）；可存储 Ergast 不提供的数据（历史积分摘要、FIA 升级、FastF1 遥测）；离线时有缓存兜底。缺点：需维护数据同步逻辑和 Supabase 表结构
  - C：**纯 Supabase** — 优点：数据完全自控。缺点：需自行获取和导入所有历史数据、缺少实时数据更新能力
- **决策**：选择 B — 双层策略。读取优先级：Supabase 缓存 → Jolpica API 降级 → mockData 兜底。
- **原因**：F1 数据有两个特性非常适合缓存：(1) 历史数据基本不变，一次导入永久使用；(2) 比赛日数据更新频率可预测（每 30 秒刷新足够）。双层策略实现了"热数据走缓存、冷数据走 API、挂了有 mock 兜底"的三级保障。代码中 `src/api/ergast.ts` 和 `src/api/supabase.ts` 各自封装，`useCachedData` Hook 统一了缓存逻辑。
- **代价**：需维护数据同步逻辑（`scripts/backfill-*.ts`）。Supabase 有免费额度限制（500MB 数据库），如果未来存储大量 FastF1 遥测数据可能不够——目前遥测数据以静态 JSON 存在项目目录中规避了这一问题（见 ADR-004）。
