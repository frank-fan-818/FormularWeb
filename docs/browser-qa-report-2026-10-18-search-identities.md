# 搜索重复排查与验证记录

- Date: 2026-10-18（Asia/Shanghai）
- Branch: `codex/points-completed-race-alignment`
- Build URL: `http://127.0.0.1:4173`（本地生产构建）
- Scope: 全局搜索的数据来源、身份合并、缓存及详情页跳转。

## 根因

搜索 API 同时读取 Supabase 与 Jolpica，然后仅按原始 ID 合并。数据库导入脚本
`scripts/import-f1db-current-schema.js` 使用 F1DB 全名 ID，将连字符转为下划线；
Jolpica 往往使用姓氏 ID。两者代表同一实体，但原始 ID 不同。

| 人物 | Supabase ID / 国籍 | Jolpica ID / 国籍 |
| --- | --- | --- |
| Charles Leclerc | `charles_leclerc` / `monaco` | `leclerc` / `Monegasque` |
| Charles de Tornaco | `charles_de_tornaco` / `belgium` | `tornaco` / `Belgian` |

这与用户截图中的名称、大小写、国籍和代码差异一致。索引构建和组件渲染各遍历一次条目，
重复已在数据合并阶段产生。v5 localStorage 搜索索引还会缓存这些重复，TTL 为 24 小时。

## 真实数据审计

使用项目配置的浏览器只读权限分页读取 Supabase，并直接分页读取 Jolpica 原始资料。
未修改数据库，未输出或保存凭据。

| 类别 | Supabase 条数 | 审计结果 |
| --- | ---: | --- |
| 车手 | 916 | 规范化姓名无重复；截图两位车手各一条 |
| 车队 | 187 | ATS、Lotus 各有两个不同 ID 的历史实体，不能直接按名称删除或合并 |
| 赛道 | 79 | 规范化名称无重复 |
| 赛事 | 1171 | `(season, round)` 无重复 |

Jolpica 返回车手 881 条、车队 214 条、赛道 78 条。两源存在 762 组车手同名异 ID 对应。
另有扩展姓名、昵称、Jr. 后缀及历史出生日期分歧，不能只比较显示名称或三字母代码。

用同一批快照运行旧合并规则得到 1723 条车手搜索记录；修复后为 931 条，规范化姓名重复为 0。
其中保留了数据库中不存在的 15 条上游记录。搜索 `Charles` 得到 De Tornaco、Leclerc、Pic、Pozzi 各一条。
全量车手、车队、赛道身份合并本机单次测量约 21 ms；这是本地诊断值，不是性能 SLA。

## 修复

- `src/utils/searchSources.ts`：独立的纯数据合并函数；以数据库记录和路由 ID 为主，保留上游名称及 ID 为搜索别名，补齐缺失元数据。
- 车手以 ID、完整姓名、出生日期构建候选索引；匹配时验证身份，遇到歧义保留独立记录，避免通过同生日、空姓名、复用代码误合并。
- 对历史生日冲突，仅在完整姓名及全名/姓氏 ID 关系均能佐证时合并，保留数据库生日值。
- 车队与赛道处理 ID 格式和已核实的来源别名；ATS 与 Valencia 的来源 ID 碰撞单独区分，保留不同历史实体。
- `src/api/search.ts`：读取出生日期；实体分页改用唯一 ID 排序，避免同姓/同名排序在分页边界不稳定；赛事继续按赛季及轮次合并。
- `src/utils/search.ts`：把合并后的上游别名纳入索引，仍可通过原来源名称检索。
- `src/hooks/useGlobalSearch.ts`：搜索缓存升为 v6，移除 v1–v5，避免已缓存的重复继续显示。

## 验证

- `npm test`：79 个测试文件，464 项通过。
- `npm run build`：通过（包含 TypeScript 编译）；原有 logger 静态/动态混合导入提示仍存在。
- 相关源文件、测试文件及 E2E 文件 ESLint：零警告通过。
- `npm run encoding:check`：397 个 UTF-8 源文件通过。
- `git diff --check`：通过。
- 浏览器命令：`node scripts/run-browser-qa.mjs e2e/smoke.spec.ts e2e/search-identities.qa.spec.ts --project=desktop-chromium --project=mobile-chromium --grep "renders without a browser error|global search"`
- 浏览器结果：25 项通过，5 项按现有测试策略跳过（手机端详细资料路由及已有四类导航测试）；新增搜索身份用例在两个尺寸均实际执行。

浏览器测试使用受控的双来源响应，覆盖截图重复的复现数据、v5 重复缓存升级、刷新后的 v6 缓存、
车手数据库 ID 跳转、不同显示名称的赛道别名跳转以及车队去重跳转。已有用例覆盖车手、车队、赛道和赛事四类搜索导航。
真实远端数据的身份合并另外通过上述快照核验，未把受控浏览器响应当作生产数据审计证据。

## Browser QA

- Routes checked: `/`、`/races`、`/races/1`、`/drivers/max_verstappen`、`/constructors/red_bull`、`/circuits/monaco`；另包含登录、注册、密码、隐私、设置及 404 冒烟检查。
- Search destinations checked: `/history/drivers/charles_leclerc`、`/circuits/melbourne`、`/history/constructors/alfa_romeo`，以及已有四类搜索导航用例。
- Viewports checked: Desktop 1440×900；Mobile 375×812。
- Findings: 搜索结果无重复、文字与控件无重叠；新增搜索流程无控制台错误或非导航取消导致的失败请求。
- Blocking: 无。
- Screenshot paths: `artifacts/search-audit/desktop.png`、`artifacts/search-audit/mobile.png`。
- Raw diagnostic paths: `artifacts/search-audit/sources.json`、`verification.json`、`races.json`（均在 Git 忽略的 artifacts 目录中）。

当前结果为本地代码和构建验证，尚未部署到线上。

## PR 79 跨浏览器测试修复

- CI run `39109018845` 的其他任务通过，Browser QA 中此搜索用例在 Firefox 和 WebKit 失败。
- 已在本地复现 Firefox 的 `page.goto: NS_BINDING_ABORTED`。CI trace 显示 WebKit 的失败请求是 `Load request cancelled`：离开页面时取消的日历、赛道数据或延迟资源请求。原监听器仅排除 Chromium 的 `net::ERR_ABORTED`。
- 将缓存持久化检查移到首页搜索完成后的单独 reload；车手、赛道与车队导航使用 SPA 历史返回，并等待真实详情标题和历史内容。补齐详情页所需的受控响应，防止仅检查 URL 就让空档案通过。
- 仅排除三个明确的浏览器取消错误名称，其他请求失败仍断言为空，并保留具体错误类型与 URL。保留控制台错误、重复数量、路由 ID、v5 删除和 v6 缓存检查。
- 变更仅涉及测试和本记录，提交类型为 `test:`，按版本规则保持 `0.23.1`。
- `src/utils/searchSources.test.ts`、`src/utils/search.test.ts` 和 `src/hooks/useGlobalSearch.test.ts`：25 项通过。相关 ESLint 与差异检查通过。
- 生产构建 URL：`http://127.0.0.1:4173`；应用代码和生产构建沿用已验证的 `f9142e65`。
- 浏览器：桌面 Chromium 1440×900、手机 Chromium 375×812、平板 Chromium 768×1024、桌面 Firefox 1440×900、手机 WebKit 375×812；每种连续运行 3 次，15 项全部通过，无重试。
- 证据：`artifacts/pr79-search-baseline.log`、`artifacts/pr79-search-matrix.log`、`artifacts/pr79-ci-browser/test-results/` 和本地 `artifacts/browser-qa/test-results/`。搜索截图由各用例输出为 `search-identities.png`。
