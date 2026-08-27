## ADR-004：FastF1 遥测数据存储 — 静态 JSON 而非实时 API 调用

- **背景**：FastF1 是一个 Python 库，用于获取 F1 比赛的遥测数据（每圈速度、轮胎策略、天气等）。在前端 TypeScript 项目中无法直接调用 Python 库。需要决策如何将 FastF1 数据集成到应用中。
- **选项**：
  - A：**实时 API 桥接** — 运行 Python 后端服务，前端通过 HTTP API 实时请求数据。优点：数据始终最新。缺点：需要额外的后端服务、部署复杂度倍增、FastF1 数据本身不会变化（历史比赛数据是固定的）
  - B：**预导出为静态 JSON** — 用 Python 脚本（`scripts/fastf1_export.py`）一次性导出数据为 JSON 文件，放在项目目录中，前端直接 `fetch` JSON。优点：零后端依赖、加载极快、可离线、部署简单。缺点：数据更新需要手动重新运行脚本
  - C：**导入 Supabase** — 在 JSON 基础上，将常用查询结果存入 Supabase 表，通过 SQL 查询。优点：更强大的查询能力。缺点：增加数据库存储成本
- **决策**：选择 B（静态 JSON）+ 可选 C（关键数据导入 Supabase）。
- **原因**：FastF1 数据是一次性获取的历史数据（比赛结束后不变化），预导出为 JSON 是最合理的选择。Python 脚本可通过 npm scripts 执行（`npm run fastf1:export-*`）。JSON 文件放在 `f1_cache/` 目录中，已有 `.gitignore` 排除（文件较大）。关键分析结果（如 lap times、compound strategy）可选择性地导入 Supabase 以支持列表页的快速查询。
- **自动更新补充**：`.github/workflows/refresh-fastf1-analytics.yml` 每 3 小时检查一次已经结束并度过 4 小时可用性窗口的场次。它只刷新缺失或不完整的 `R/Q/S/SQ/SS` 快照，完整性校验通过后写入 Supabase，并创建或更新静态 JSON 备份 PR。工作流失败会保留 manifest/export-report 诊断制品，由 GitHub Actions 失败状态负责告警。
- **代价**：赛后分析不是实时数据；正常情况下在场次开始后约 4–7 小时进入 Supabase（4 小时等待 FastF1 上游稳定，加上最多 3 小时调度间隔）。静态备份仍需合并自动 PR 才会进入下一次前端部署，但前端可直接从 Supabase 读取已入库快照，不受 PR 合并时间影响。
