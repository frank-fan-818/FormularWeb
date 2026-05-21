## ADR-001：前端技术栈选型 — React 18 + Vite + TypeScript

- **背景**：项目启动时需要选择前端框架和构建工具。候选方案包括 Next.js（SSR/SSG能力）、Create React App（已停止维护）、Vite（新一代构建工具）。项目是 SPA 数据可视化应用，主要面向桌面端，SEO 不是核心需求。
- **选项**：
  - A：**Next.js** — 优点：SSR/SSG、文件路由、API Routes、Vercel 原生支持。缺点：SSR 对纯数据看板增加复杂度、学习曲线、构建速度慢于 Vite
  - B：**Vite + React 18** — 优点：极快的 HMR 和构建速度、原生 ESM 开发、可配置的开发代理（用于跨域 API）、Tree-shaking 优秀。缺点：无 SSR（本项目不需要）
  - C：**Create React App** — 优点：社区熟悉。缺点：Webpack 构建慢、已停止维护、配置不灵活
- **决策**：选择 B — Vite + React 18 + TypeScript
- **原因**：项目是纯 SPA（F1 数据看板），不需要 SSR。Vite 的开发体验远超 CRA 和 Next.js 纯 SPA 模式。开发代理功能（`vite.config.ts` 中配置）让 Jolpica API 跨域问题零配置解决。TypeScript 严格模式确保类型安全。Vercel 部署通过 SPA fallback 配置（`vercel.json`）同样支持。
- **代价**：如果未来需要 SEO（如 F1 新闻内容），需要额外引入 SSR 方案或迁移到 Next.js。无文件路由系统，路由需手动在 `src/router/index.tsx` 中配置。构建输出为纯静态文件，无服务端能力。
