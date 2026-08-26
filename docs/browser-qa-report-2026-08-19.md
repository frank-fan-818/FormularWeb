# Browser QA Report

- Date: 2026-08-19
- Branch: `feature/extreme-page-load-performance`
- Build or dev URL: `http://127.0.0.1:4173`（本地生产构建服务器）
- Routes checked: `/`, `/races`, `/races/1`, `/drivers/max_verstappen`, `/constructors/red_bull`, `/circuits/monaco`, `/settings`, `/login`, `/privacy`, 404；另验证搜索四类实体和历史赛季路由
- Viewports checked: 1440×900、768×1024、375×812
- Findings: 首轮发现 Service Worker 接管 `/f1-api/` 后绕过 Playwright 页面级 mock；已将普通 QA 与专用 SW 生命周期项目隔离。React Router v7 声明式迁移、Critical CSS、异步首页、英文资源延迟加载与原生 ECharts 生命周期均已覆盖。Lighthouse 找到首页统计标签对比度不足，已改用设计令牌 `--text-secondary`；Accessibility 恢复 1.00。分包变化也暴露了 SW 测试桩只改写入口文件的问题，现按 manifest 找到 Settings 的真实 importer。0.14.0 新增全局动效系统专项断言：正常模式下路由入口保留空间连续性且首要内容始终完全可见；`prefers-reduced-motion: reduce` 下路由、组件与图表动效关闭。桌面、平板、手机截图均完成视觉复核。
- Blocking: 无。最终 30 passed / 19 conditional skipped / 0 failed；控制台、首方脚本/样式失败、横向溢出、正常/减少动态效果两种偏好均通过断言。
- Screenshot paths:
  - `artifacts/browser-qa/test-results/smoke--renders-without-a-browser-error-desktop-chromium/home.png`
  - `artifacts/browser-qa/test-results/smoke--renders-without-a-browser-error-tablet-chromium/home.png`
  - `artifacts/browser-qa/test-results/smoke--renders-without-a-browser-error-mobile-chromium/home.png`
  - 对应三视口的 login 与 404 截图位于相邻测试结果目录。
