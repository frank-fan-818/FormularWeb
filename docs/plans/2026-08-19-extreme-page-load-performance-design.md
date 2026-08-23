# 极致页面加载性能设计

**日期**：2026-08-19  
**状态**：已按用户授权自行审定  
**范围**：全部 Web 路由、公共数据、PWA 热启动、性能门禁

## 1. 问题定义

页面“快”不是单一 Lighthouse 分数，而是用户获得可用答案前所有串行成本之和：

```text
可用答案时间 = DNS/TCP/TLS + TTFB + 关键字节传输 +
               JS/CSS 解析执行 + 首屏布局绘制 +
               必需数据等待 + 用户理解成本
```

本地 0.13.4 基线：初始/首页 JS 120.0 KiB gzip；Race Info 340.3 KiB；Race Analysis 460.6 KiB；最大 chunk 133.8 KiB；Lighthouse 中位性能 0.97。五次运行中 FCP 约 2.0–2.1s、LCP 约 2.1–2.26s、TBT 0–20ms。主要可见税是两条 render-blocking CSS（约 602ms 模拟收益）、入口非关键运行时代码、19 KiB gzip 的 head 管理依赖、5.9 KiB gzip 的日期库、未覆盖全站的意图预取，以及公共 API 缺少边缘/SW 热缓存。

## 2. 第一性原理拆分

### 2.1 哪些字节必须在第一次绘制前存在？

只包括 React 最小运行时、路由壳、当前页面首屏结构、当前语言最小资源和保证布局不跳动的样式。性能采集、错误上报实现、Service Worker 升级协调、搜索、图表、表格、登录 SDK 和未访问路由都不是第一次绘制的物理前提。

### 2.2 哪些工作必须由主线程现在执行？

只有构建首屏 DOM 与计算首屏样式。Web Vitals 订阅、更新检查、非首屏区块布局、图表实例化和预取可在 idle、intent 或 near-viewport 阶段执行。

### 2.3 哪些网络请求必须串行？

HTML 必须先到；其余应最大程度并行。动态路由不可避免地在入口解析后发现，因此用用户 hover/focus/pointer intent 提前发现。数据请求独立并行，且热缓存必须能够在网络前返回。

### 2.4 什么可以缓存？

带 hash 的资产永久缓存；公共 GET F1 数据按当前/历史语义短期或长期缓存；失败响应、登录数据、非 JSON 和变更请求不可缓存。SW 使用有界 stale-while-revalidate，Vercel 使用共享边缘短缓存。

### 2.5 什么不能为了分数牺牲？

数据正确性、错误可见性、可访问性、安全头、版本恢复、移动布局和发布门禁不可交换。

## 3. 备选方案

### A. 迁移 SSR/Next.js

优点是 HTML 可携带页面内容并改善冷启动；缺点是迁移面巨大、数据源和缓存重做、与当前 ADR 冲突。当前瓶颈并不需要框架迁移才能解决。**不选。**

### B. 保持架构，做分层手术式优化（选择）

移除首屏非必需依赖、延后运行时、意图预取全路由、公共数据双层缓存、视口渲染隔离、收紧预算。收益可量化、回归范围可测试、能分步回滚。**选择。**

### C. 全量预缓存所有路由

二次访问快，但安装和首次加载浪费大量流量，图表/表格会污染缓存，移动端更差。**拒绝。**

## 4. 设计

### 4.1 入口瘦身

- 用轻量 `DocumentHead` 取代 `react-helmet-async`。
- Web Vitals 与生产运行时在首次渲染后动态加载。
- 全局错误处理保留，但其重实现按错误发生时加载。
- 用原生 Date/Intl 替代当前首屏所需的 dayjs；目标是完全移除依赖。

### 4.2 路由意图预取

- 路由 import loader 成为单一来源，React.lazy 与预取共用同一函数。
- `pointerenter`、`focus`、触摸预备事件触发目标模块加载。
- 尊重 `navigator.connection.saveData`、`2g`、`slow-2g`。
- Promise 由 ESM 运行时去重；错误吞掉，真正导航仍是事实来源。
- 比赛页签预取目标子页，不预取 ECharts，图表仍近视口加载。

### 4.3 数据路径

- Vercel `/f1-api` 设置共享边缘短缓存与 stale-while-revalidate。
- Service Worker 对同源 `/f1-api` JSON 实施有界 stale-while-revalidate。
- 缓存写入前验证 `response.ok` 与 JSON content-type。
- 网络失败时返回缓存；无缓存时保持原错误。
- 当前赛季数据仍由应用层 freshness notice 表达，SW 不伪造更新时间。

### 4.4 渲染成本

- 首页首屏之后的主要 section 使用 `content-visibility: auto` 和合理 `contain-intrinsic-size`。
- 已有表格和 ECharts 视口延迟策略保留。
- 不对首屏 masthead 使用渲染隔离，避免 LCP 推迟。

### 4.5 预算

- 初始 JS 从 180 KiB 门禁收紧到 100 KiB。
- 首页关键路径从 140 KiB 收紧到 110 KiB。
- Race Info/Analysis 上限按实际收益收紧，不以拆出无意义小 chunk 规避。
- Lighthouse FCP 从 warning 2.0s 调整为 error 1.8s 需要以稳定五次中位验证；若本地固定模拟存在不可消除平台底噪，保留 warning 并记录实测，不伪造。

## 5. 数据流

```text
用户导航意图
  ├─ 省流/2G → 不预取
  └─ 正常网络 → 目标路由模块 Promise
                       ↓
实际导航 → React lazy 复用模块 → 页面结构
                       ↓
                  应用缓存读取
                ┌──────┴──────┐
             命中立即显示    未命中
                ↓              ↓
          后台刷新请求 ← SW API 缓存 ← Vercel Edge ← Jolpica
```

## 6. 错误处理

- 预取失败不显示错误、不阻止导航。
- SW 缓存失败回退网络；网络失败且有缓存回退缓存。
- 缓存验证失败不落盘。
- `DocumentHead` 卸载时不恢复旧页面标题，下一路由负责设置；404/隐私等所有路由必须显式设置。
- runtime 动态 import 失败不得阻止应用。

## 7. 测试与对抗性检查

- 单测网络条件判断、路由 loader 映射、Date 边界、head 更新。
- 构建后验证 manifest 首屏依赖、SW 策略与缓存上限。
- 对比五次 Lighthouse 中位数和每次离散值。
- 浏览器验证六个核心路由、三视口、控制台、失败请求、离线热启动。
- 红队测试重复 intent、Save-Data、2G、错误 content-type、404、旧 SW 多标签页、过期 chunk。

