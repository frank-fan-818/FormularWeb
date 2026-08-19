# F1 数据中心

面向桌面和移动端的 Formula 1 数据产品，提供赛季积分、赛历、车手、车队、赛道、比赛周末分析、遥测和预测等功能。公开赛事数据无需登录；可选 Supabase 配置用于账号会话和经过脱敏的错误诊断。

## 本地启动

要求 Node.js 24。

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

默认地址为 `http://localhost:3000`。未配置 Supabase 时，公开数据功能仍可使用，账号入口会明确显示未配置状态。

浏览器只允许使用 `VITE_SUPABASE_ANON_KEY`。`SUPABASE_SERVICE_ROLE_KEY` 仅供本地或受保护 CI 中的管理脚本使用，绝不能添加 `VITE_` 前缀。

## 核心命令

```powershell
npm test                 # 单元测试
npm run test:coverage    # 全量覆盖率与基线门禁
npm run test:e2e         # Chromium 桌面/移动端路由烟雾测试
npm run lint:strict      # 零警告 ESLint
npm run type-check       # TypeScript
npm run build            # 生产构建
npm run quality:check    # 本地完整发布前门禁
```

`npm run lighthouse` 会对已生成的 `dist` 启动本地预览并执行 Lighthouse 门禁；CI 运行五次并取中位数。

## 数据库与安全

按顺序执行 `scripts/sql/` 中的基础表结构和最新生产加固迁移。发布前至少执行：

```powershell
npm run security:check
npm run security:audit
```

安全检查会阻止跟踪环境文件、私钥、常见硬编码凭据、浏览器匿名写权限、危险 HTML/动态代码以及生产源码中的 `console.log`。漏洞报告方式见 [SECURITY.md](./SECURITY.md)。

## 发布

CI 对安全扫描、全部依赖的高危漏洞、严格 lint、类型、覆盖率、构建、性能预算、Lighthouse、CodeQL 和浏览器 QA 设有阻断门禁。当前候选版本的差距闭环与残余风险见 [发布就绪报告](./docs/release-readiness-report.md)，上线前还需完成 [发布检查清单](./docs/release-checklist.md)。

分支采用 `main`（生产）与 `develop`（测试/集成）双层模型。新功能、维护和依赖更新先合入 `develop`；只有完整发布门禁通过后，才通过 Pull Request 将 `develop` 合入 `main`。详细规则见 [分支策略](./docs/branching-strategy.md)。

## 数据来源

赛事数据主要来自 Jolpica/Ergast 兼容接口、项目内缓存数据和经过处理的 FastF1/FIA 数据。上游暂不可用时，页面应显示加载、空状态或错误状态，不应以虚构结果冒充实时数据。
