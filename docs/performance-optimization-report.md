# 0.13.4 → 0.14.0 页面加载与专业动效优化报告

## 0.14.0 动效系统验证

- 全局动效采用 CSS 语义令牌与一个轻量 `useReducedMotion` 订阅器，没有引入运行时动画依赖。
- 首要内容仅做 transform 入场且首帧 opacity 固定为 1，避免为视觉淡入牺牲 LCP。
- ECharts 动效统一在 `EChartsPanel` 中治理；系统减少动态效果偏好会将初始化和更新动画时长归零。
- 生产门禁：Initial JS 82.6 KiB gzip、Home 89.6 KiB、Race Info 304.9 KiB、Race Analysis 424.3 KiB、custom ECharts 190.2 KiB、最大单块 134.2 KiB。
- Lighthouse 5 次运行：Performance 0.97、Accessibility 1.00、Best Practices 1.00、SEO 1.00；动效改造没有造成性能评分回退。

**日期**：2026-08-19  
**分支**：`feature/extreme-page-load-performance`  
**基线**：优化前的 0.13.4 生产构建  
**测量方法**：相同工作站、生产构建、gzip 静态依赖图；移动 Lighthouse 连续五次取中位数

## 1. 结论

本轮没有通过删功能或隐藏错误换取分数。核心路线是减少首次访问的必要工作，把非必要工作移出关键路径，并让缓存、预取和预算成为可验证的长期机制。

首屏 JavaScript 从 **120.0 KiB 降至 82.6 KiB gzip**，减少 **37.4 KiB（31.2%）**；首页业务模块到达后的完整静态路径为 **89.6 KiB gzip**。Lighthouse 五轮中位数为 Performance **0.97**、Accessibility **1.00**、Best Practices **1.00**、SEO **1.00**，TBT 约 **10 ms**。

## 2. 量化结果

| 指标 | 优化前 | 优化后 | 变化 |
| --- | ---: | ---: | ---: |
| Initial JS | 120.0 KiB | 82.6 KiB | -31.2% |
| Home 关键路径 JS | 120.0 KiB | 89.6 KiB | -25.3% |
| Race Info 关键路径 JS | 340.3 KiB | 304.9 KiB | -10.4% |
| Race Analysis shell JS | 460.6 KiB | 424.3 KiB | -7.9% |
| 最大异步 chunk | 133.8 KiB | 134.0 KiB | +0.2 KiB，低于 140 KiB 门禁 |
| Lighthouse Performance | 0.97 | 0.97 | 持平，传输显著下降 |
| FCP | 1.997–2.107 s | 1.993 s 代表轮次 | 稳定 |
| LCP | 2.106–2.264 s | 2.178 s 代表轮次 | 稳定 |
| TBT | 0–20 ms | 6 ms 代表轮次 | 接近零阻塞 |
| CLS | 多数约 0.029 | 0.004 代表轮次 | 显著下降 |

构建预算已收紧为：Initial 85 KiB、Home 92 KiB、Race Info 325 KiB、Race Analysis 450 KiB、定制 ECharts 总运行时 200 KiB、任意异步 chunk 140 KiB。Critical CSS 还设有 48 KiB 原始体积上限，并禁止生产 HTML 残留阻塞样式链接。

## 3. 第一性原理拆分

页面可用时间可以拆成：

```text
可用时间 = 连接与传输 + 下载字节 + 解析/编译 + 主线程执行
         + 数据等待 + 布局/绘制 + 用户寻找入口的时间
```

因此优化必须分别回答：首屏究竟需要什么、哪些工作可以延后、哪些请求可以预测、哪些结果可以复用、失败时是否仍可完成主要任务。

### 3.1 删除不成比例的首屏运行时

- 用小型 `DocumentHead` 代替整套 `react-helmet-async`，保留 title、description、robots 更新与跨路由清理。
- 以原生日期帮助函数替代直接 `dayjs` 使用，额外覆盖日期边界和 DST 测试。
- 将完整 i18next/react-i18next 运行时替换为与实际需求等价的轻量订阅层：中英资源、fallback、插值、持久化、HTML `lang` 同步均保留。
- Web Vitals 与全局错误 logger 改为空闲期/异常发生时动态导入，不参与首屏竞争。

### 3.2 把用户意图转化为等待时间

- 所有路由加载器统一到 `routeModules`，React.lazy 与预取共享同一 Promise 缓存。
- 导航、卡片、比赛页签在 hover、focus、pointer down 时预取最小目标模块集。
- Save-Data、2G、slow-2G 明确禁用预取，避免以流量换速度。

### 3.3 减少重复网络与离线等待

- `/f1-api/` 在边缘设置 5 分钟共享缓存与 24 小时 stale-while-revalidate。
- Service Worker 对成功 JSON 使用有界 stale-while-revalidate；错误页、非 JSON、失败响应不入缓存；上限 120 项。
- 相关部署头、缓存模式、内容类型限制和容量上限均有策略测试。

### 3.4 降低首屏以下布局成本

- 首页 masthead/LCP 候选保持正常渲染。
- 仅首屏以下的赛季脉搏、比赛卡、积分榜和统计区使用 `content-visibility: auto` 与固有尺寸占位。
- 不支持该能力的浏览器自动回退为原有渲染。

### 3.5 Critical CSS 与安全路由运行时

- 构建期将入口与首页关键 CSS 内联进 HTML；生产 HTML gzip 约 7.9 KiB，不再产生首屏 stylesheet 阻塞往返。
- 首页视觉 CSS 保持在入口，首页业务 JavaScript 独立到达；Suspense 骨架不会裸奔或产生 FOUC。
- React Router 升级到 7.18.2，`npm audit --audit-level=moderate` 为 0。
- 项目未使用 loader/action/SSR 数据路由能力，因此由 `createBrowserRouter` 改为等价的声明式 `BrowserRouter + Routes`，删除未使用的数据路由运行时。
- 英文资源只在英文首选项或切换语言时加载；中文默认首屏不下载第二套文案。

### 3.6 ECharts 定制运行时

- 仅注册实际使用的 Bar、Line、Lines、Scatter、Grid、Tooltip、Legend、MarkArea、MarkLine、MarkPoint、Title 与 CanvasRenderer。
- 移除 ECharts Aria 运行时模块，图表容器继续提供 `role="img"` 和可访问描述。
- 移除 `echarts-for-react` 通用包装，直接管理实例、option 更新、ResizeObserver 与 dispose。
- 图表仍在接近视口 320 px 时才初始化；定制运行时总量为 190.0 KiB gzip，受 200 KiB CI 门禁保护。

## 4. 对抗性审查

| 攻击问题 | 发现/结论 | 处置 |
| --- | --- | --- |
| 预取是否制造下载风暴？ | import Promise 会复用，但弱网仍可能浪费流量 | 只在意图事件触发；Save-Data/2G 禁止；单测覆盖映射 |
| SW 会不会缓存 API 错误页？ | 若只判断 200，HTML 错误页可能污染离线数据 | 同时要求 `response.ok` 和 JSON content-type |
| 缓存会不会无限增长？ | 数据 URL 随赛季/查询增加 | 每次写入后裁剪到 120 项 |
| SW 会不会破坏测试桩？ | 实际发现 Playwright page route 无法拦截 SW fetch | 普通 QA 项目阻止 SW，专用项目真实验证 SW 生命周期 |
| 语言切换是否仍响应式？ | 移除 i18next 后存在跨组件不同步风险 | `useSyncExternalStore` 订阅；E2E 验证设置页与页头同步 |
| 日期是否在时区/DST 边界漂移？ | 直接字符串/UTC 比较容易偏一天 | 本地日期窗口纯函数与 DST 单测 |
| 元信息是否跨页残留 noindex？ | 轻量替代最容易漏删 robots | 明确删除未提供的可选 meta；单测覆盖 |
| `content-visibility` 是否伤害 LCP？ | 若加到首屏会延迟关键内容 | masthead 不使用，只隔离首屏以下区块 |
| CSS 改动是否降低可访问性？ | Lighthouse 找到两个深色主题红字对比不足 | 改用主题 `--f1-red-text`；Accessibility 恢复 1.00 |
| 动态构建是否出现 stale chunk 刷新循环？ | SW 与分块越积极，升级风险越高 | 原有一次性恢复保留；专用多标签 SW E2E 通过 |
| Critical CSS 是否变成无限膨胀 HTML？ | 全量内联会损害缓存与文档体积 | 只内联入口关键样式；48 KiB 原始上限；构建后验证无阻塞 link |
| Router 安全升级是否拖大首屏？ | v7 数据路由模式一度令入口超预算 | 改用项目实际需要的声明式模式；audit 归零且首屏进入 85 KiB |
| 图表裁剪是否破坏 resize/卸载？ | 去掉 React wrapper 后需自己管理生命周期 | ResizeObserver、窗口 fallback、option 更新和 dispose 明确实现；浏览器回归通过 |

## 5. 验证证据

- 266 个 Vitest 测试通过，46 个文件；新增国际化、日期、路由预取、DocumentHead 测试。
- ESLint strict、TypeScript、UTF-8、部署策略、安全扫描、Semgrep、生产构建、Service Worker 验证全部通过。
- 浏览器 QA：29 通过、17 条件跳过、0 失败；桌面 1440×900、平板 768×1024、移动 375×812。
- 覆盖 `/`、`/races`、比赛详情、车手、车队、赛道、设置、搜索、历史赛季导航、404、静态资产 404 和多标签 Service Worker 升级。

## 6. 仍存在的物理边界与后续方向

1. 85 KiB 指 HTML 立即引用的首屏 JavaScript；首页模块到达后的完整静态路径是 89.6 KiB。继续压到完整路径 85 KiB 需要替换 React/Router 基础运行时或拆首页业务，两者都应以真实 FCP/LCP 而非单纯包体决定。
2. Lighthouse 的 Network Dependency Tree insight 仍提示首页异步模块链，但没有阻塞质量门禁；当前五轮 Performance 为 0.97。后续应以生产 RUM 的 p75 FCP/LCP 验证网络条件差异。
3. ECharts 最大单块为 134.0 KiB、完整定制运行时 190.0 KiB，已经不在首屏且按视口初始化。进一步下降需将遥测地图与常规折线能力拆成不同注册表，并增加图表像素级视觉回归。

当前结论：React Router moderate 公告、Critical CSS 和 ECharts 定制构建均已完成；安全审计为 0，85 KiB 首屏门禁已落地，达到发布候选标准。
