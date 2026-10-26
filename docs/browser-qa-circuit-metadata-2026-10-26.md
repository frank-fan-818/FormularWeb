# 赛道资料补全 QA

- 日期：2026-10-26。
- 分支：`codex/season-fastest-pit-stop`。
- 构建地址：本地生产构建 `http://127.0.0.1:4173`，测试后关闭临时服务。
- 改动范围：`src/data/circuit-profiles.json`、`src/utils/circuitData.ts`、`circuitEnhancements.ts`、`circuitIds.ts`、`circuitValues.ts`、`src/hooks/useCircuitDetailData.ts`、`src/pages/Circuits.tsx`、`CircuitDetail.tsx`，以及对应测试、快照生成脚本和来源文档。
- 目标：列表与详情正确匹配赛道资料；远端空行、占位文本、慢请求和失败不会使已知资料退化为“资料待补”。

## 验证结果

- 全量 Vitest：116 个文件、921 项通过。针对别名缺失及远端占位覆盖先重现失败，再验证修复；另重现 Las Vegas 将总里程除以圈数错误生成 6.118 km 的问题，改用已发布的 6.201 km。
- 生产构建、TypeScript、严格 ESLint、UTF-8 检查通过。
- 性能预算通过：初始 JS 80.5 KiB gzip，首页路径 92.0 KiB gzip；赛道快照没有突破关键路径预算。
- 赛道浏览器套件：18 项通过，包括全部 78 条赛道、18 个 API 别名的详情逐页检查、78 卡片列表、列表进入详情、慢速资料请求、官方图加载/不可用、放大交互、明暗主题。
- 三种尺寸分别遍历全部赛道和别名：桌面 1440×900、手机 375×812、平板 768×1024。所有基础统计均有值，无“资料待补”或永久加载占位，无页面横向溢出。
- 通用路由：13 项桌面冒烟通过，含 `/`、`/races`、`/races/1`、`/drivers/max_verstappen`、`/constructors/red_bull`、`/circuits/monaco`，以及账户、设置、隐私和不存在路径。
- 检查浏览器异常、控制台错误/警告和失败请求。成功流程无异常；仅排除 Playwright 因测试配置阻止 service worker 注册所产生的固定工具警告。图片故障场景专门验证预期错误状态。
- 已直接查看马德里手机、阿德莱德桌面、红牛环平板截图：中文正确，长距离数值和卡片文字无重叠。

## 截图

本地忽略目录 `artifacts/browser-qa/screenshots/`：

- `metadata-madring-{desktop,mobile,tablet}-chromium.png`
- `metadata-montreal-{desktop,mobile,tablet}-chromium.png`
- `metadata-spielberg-{desktop,mobile,tablet}-chromium.png`
- `metadata-adelaide-{desktop,mobile,tablet}-chromium.png`
- 原有图谱套件同时保存各赛道和明暗主题截图。

## 数据边界

基础数据覆盖 78 条已收录赛道；本地历史场次快照截至 2025 年完整赛季，马德里单独核实至 2026。运行时保留远端有效字段的优先级。本轮不等于全面重算生涯统计或不同历史布局的单圈纪录。

当前赛历工程参数已补齐。未有可靠来源的历史赛道左右弯、高差属于可选字段，不再显示永久占位卡片，未填猜测数字。官方赛道图原有来源缺口仍保留明确的不可用提示。本次没有更改图像来源与布局样式常量。

数据来源和更新步骤见 [赛道资料说明](circuit-profile-data.md)。本轮未提交、推送或部署。验证无阻塞问题。
