# Season Points Comparison Implementation Plan

**Goal:** 在车手和车队详情的赛季积分走势图中选择同类对手，直观看到累计积分与差距。

**Architecture:** 保留未开启对比时的现有图表。开启对比后按需取得同赛季逐站官方积分榜，共享请求、限制并发，使用相同分站轴显示两条曲线；仅在悬停分站的提示中显示双方积分和该站差距，不再在图表上方显示固定积分差摘要。选择对手只在已加载快照中切换。接口、状态、图表转换和控制界面分别放入 api/hooks/utils/components，页面只负责接入。

**Tech Stack:** React 18、TypeScript、Ant Design 5、现有 EChartsPanel 与设计令牌。

## Design brief

- Audience/primary task: 关心赛季走势的用户，比较当前车手或车队与另一位同赛季参赛者的积分变化。
- Density: 默认低密度，标题右侧一个“对比”按钮；开启后只出现原生选择框和数据截止分站，领先/落后/同分结论仅在图中悬停时显示。原生控件支持键盘和手机系统选择器，避免增加组件依赖。
- Chart: 沿用原有平滑曲线、圆形节点、柔和发光与渐变面积填充；双方使用不同颜色，同队车手也区分颜色。使用官方逐站累计积分，不重复加冲刺分、不以最后一站强行补齐总分。悬停显示双方积分与该站差距；保持可访问数据表。
- States: 选择前提示、加载、空积分榜、错误与重试、部分分站缺失提示；退出对比恢复原图，换页面/赛季清除选择。不存在于完整榜单的参赛者该站记 0，缺失或不完整榜单记 null。
- Responsive/accessibility: 桌面控件同行，手机自然堆叠；按钮和选择框可键盘操作，比分基线对齐，保留手机图表横向浏览。

## Tasks

1. 在 `src/api/standingsProgress.test.ts` 与 `src/utils/pointsComparison.test.ts` 编写失败测试，覆盖逐站积分、完整性、缺失快照、同分/领先/落后、小数分、转义与排序。
2. 新增 `src/types/pointsComparison.ts`、`src/api/standingsProgress.ts`、`src/utils/pointsComparison.ts`；验证接口按赛季和类型隔离缓存，每批最多四个请求。
3. 新增 `src/hooks/usePointsComparison.ts` 和生命周期测试，覆盖延迟返回、切换赛季与关闭后清理；新增共享控制组件和样式，积分差只保留在图表悬停提示中。
4. 在 `src/pages/DriverDetail.tsx`、`src/pages/ConstructorDetail.tsx` 接入控件与图表选项转换；保留现有默认走势图、加载过程、页面内容和横向浏览。
5. 新增浏览器夹具测试，覆盖车手/车队选择、同队对比、切换/清除/退出、逐站 tooltip 与表格、缺失/失败/空数据、深浅主题和三种屏幕尺寸。
6. 执行单元测试、构建、性能预算、lint、编码检查和主要路由浏览器回归，截图复核后交付。
