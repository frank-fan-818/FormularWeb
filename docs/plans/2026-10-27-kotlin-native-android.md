# Kotlin Android 原生客户端实施计划

**Goal:** 先重新设计适合手机的导航、信息层级与交互流程，再交付可安装、使用真实 F1 数据的 Kotlin Android 原生试用版，打通赛事、比赛详情和成绩查询。

**Architecture:** 在仓库内新增独立的 `native-android/` 工程，以 Jetpack Compose 实现界面。通过 HTTPS 接口复用现有数据服务与采集成果；使用 Repository、ViewModel 和明确的 UI 状态管理加载与失败，不执行 React 或加载网站来呈现核心页面。

**Tech Stack:** Kotlin、Jetpack Compose / Material 3、ViewModel、Coroutines / StateFlow、平台 HTTPS / JSON、DataStore；首个只读切片使用经校验的公开 JSON 文件缓存。Retrofit、序列化插件、Room 和 Navigation Compose 保留为接口与路由复杂度增长后的候选，当前没有引入这些依赖。

**Status:** 用户已确认连体 FP 标识、FrankPitwall 字标及紧凑红黑视觉。独立 Kotlin / Compose 公开数据试用版 `0.1.0` 已生成 APK；18 项原生单元测试、Android Lint、Debug 构建和 APK 签名校验通过。当前没有连接设备或已配置模拟器，设备运行尚未验收。详细证据见 [原生 QA](../qa/native-android-mvp.md)，源码入口见 [native-android](../../native-android/README.md)。iPhone 仍属后续阶段。

## 当前实施检查点（2026-10-27）

| 任务 | 已完成 | 仍待完成 |
|---|---|---|
| Task 0 | 四入口、平铺布局、连体 FP 品牌、可点击原型 | 原生设备上的视觉验收 |
| Task 1 | JDK/SDK/Gradle、公开接口权限依据、真实快照 | Android 设备上的网络连通性 |
| Task 2 | 独立工程、Compose 主题、矢量 Logo、启动图标 | 设备启动与系统栏验证 |
| Task 3 | 真实赛历/成绩/积分解析，转队数据与完整性检查 | 后续私有接口与认证 |
| Task 4 | 赛事、成绩、榜单、当季资料及设置原生页面；请求取消和跨赛事返回测试 | 真机手势、大字体、TalkBack、进程重建 |
| Task 5 | 公开缓存、更新时间、失败回退、主题/时区持久化 | 赛季偏好和深层路由的进程恢复；设备离线验证 |
| Task 6 | Debug APK、签名验证、构建记录 | 安装、启动、截图与真实设备完整验收 |

首个切片源码文件以 `native-android/README.md` 为准。以下详细任务清单保留原计划的验收目标，不代表所有候选库、文件名或设备检查均已实现。

## 1. 已核实的项目现状

- Web 技术栈来自当前 `package.json`：React、TypeScript、Vite、Ant Design、Zustand、ECharts。
- `capacitor.config.ts` 设置 `webDir: 'dist'`，不是配置远程网站地址。
- `android/app/src/main/java/com/formularone/app/MainActivity.java` 继承 Capacitor `BridgeActivity`；该工程仍然展示网页界面。
- `src/api/season.ts` 使用 `/f1-api` 获取赛程和积分榜，包含列表完整性与重复数据检查。
- `src/api/raceClassifications.ts` 获取正赛、排位成绩，校验分页总数和车手唯一性。
- `src/api/raceSessionResults.ts` 从 Supabase 读取部分其他场次成绩。
- `src/api/memberAccess.ts` 对私有分析检查会员会话、用户身份变化和 Storage 权限；原生端必须保留这些语义。
- `src/api/auth.ts` 存在依赖浏览器地址的回调与验证码逻辑，不能原样移植到 Kotlin。
- PATH 最初未配置工具；已在 `D:/DeveloperTools/AndroidStudio/` 和现有 SDK 目录确认并使用 JDK 21、SDK 36、Gradle 8.14.3。无需重新安装 Android Studio。
- 工作区已有 Web 修改保持原状；本批新增原生工程、构建脚本和文档，并给 `.vercelignore` 增加原生工程排除项。

## 2. 范围与第一阶段交付

第一阶段只证明最重要的一条使用路径：

`安装 APK → 赛事首页 → 打开比赛 → 选择场次并查看成绩 → 返回并保留浏览位置`

实施前先完成低保真流程与可点击原型。用户已确认“赛事 / 榜单 / 资料 / 我的”的主信息架构，比赛内采用“概览 / 成绩 / 分析”，场次使用独立选择器。用户要求减少框线、卡片与嵌套容器：采用单层侧边留白、平铺列表与文字层级，让信息充分利用手机宽度。视觉大部分借鉴现有网站，沿用现有字体、品牌色、赛事标题和数据排版，避免第一版过度简化的样式。具体细节通过原型反馈修订。首个试用包仅开放已实现的功能入口。

第一阶段包括：

1. 按重新设计的任务流程实现原生入口、导航、品牌主题与中文界面。
2. 赛事首页、赛季选择、完整赛历和下一场次时间。
3. 比赛详情：比赛名称、赛道、当地显示时间、比赛状态。
4. 正赛与排位成绩：官方名次、车手、车队、时间/状态、积分；按源数据可用性展示。
5. 加载、空数据、接口错误、重试与公开数据离线缓存。
6. Debug APK、原生测试记录、真机或模拟器截图。

账号、会员分析、新闻、换胎榜、预测与复杂图表分阶段增加。首版不包含虚假的“已实现”占位入口，不用样例数据冒充实时结果。

数据访问须先形成权限矩阵。第一阶段仅使用已确认允许客户端读取的公开数据；如某条必需接口需要登录，应补充认证前置任务或换用现有合法公开数据源，不能放开服务端权限来迁就试用版。

## 3. 架构决定及取舍

### ADR-A：独立原生工程

- 决定：新增 `native-android/`，保持现有 `android/` 工程可用作历史参考。
- 原因：避免混合 Capacitor 生成文件与 Compose 构建逻辑，便于单独构建和验证。
- 代价：仓库暂时存在两套 Android 工程，需要在 README 中清楚标识入口。
- 试用包名建议 `com.formularone.nativeapp`，与现有 `com.formularone.app` 共存；正式包名和签名沿用策略在发布前决定。

### ADR-B：Kotlin + Jetpack Compose

- 决定：核心页面采用 Compose 原生组件；使用 Material 3 控件并映射现有设计 token。
- 原因：符合用户选择的平台原生开发方向，适合列表、分段导航和数据展示。
- 代价：React、Ant Design、CSS、Zustand 与 TypeScript 逻辑不能直接运行在 Kotlin 客户端。可复用的是接口契约、业务规则、测试样本和数据资产，相关逻辑需要有测试地移植。
- iOS：本阶段不交付 iPhone 包；后续优先评估 SwiftUI 客户端。若两端业务逻辑重复成本明显，再评估 Kotlin Multiplatform，不在试用版提前引入。

### ADR-C：沿用服务端数据能力

- 决定：继续使用现有数据采集、数据库、受保护接口和静态分析成果，不把 Python 采集任务搬到手机上。
- 客户端使用明确的 HTTPS base URL；不能直接复用网页中的 `/f1-api`、`/api` 相对地址。
- 代价：App 仍然依赖接口可用性，但不会依赖加载完整网站来生成界面。需要明确超时、限流、缓存与接口版本兼容策略。

### ADR-D：先单模块，按功能分包

- 决定：先使用单个 `app` 模块，分离数据、模型和界面职责；通过简单的构造注入组合依赖。
- 原因：控制试用版构建和维护成本；出现真实需要时再拆模块或引入 DI 框架。
- 状态流：Compose Screen → ViewModel → Repository → HTTP / Room，结果通过 StateFlow 回到页面。
- 设置使用 DataStore；登录凭据不能以普通偏好项或日志存储。认证阶段另行实现基于 Android Keystore 的受保护会话存储。

### 首个切片的实现取舍

- 用平台 HTTPS / JSON 实现公开接口，使用可替换的 Repository 隔离传输层；不为小型只读缓存提前引入数据库和迁移。
- 缓存先校验后落盘，按请求标识隔离、带更新时间，保留最多 128 个公开响应；取消不会降级成缓存成功，坏响应不会覆盖好缓存。
- 页面采用显式类型栈与 Compose SaveableStateHolder；返回原比赛时恢复对应场次，相关回归测试已先失败后修复。
- 原生首版只显示已实现的“概览 / 成绩”，分析导航在会员数据和原生图表可用后增加；浏览器原型中的图表示例不进入 APK。
- 当前主题和时区使用 DataStore 持久化；完整进程死亡恢复仍须继续实施与设备验证，不能视作已完成。

## 4. 实施任务与验收

以下路径均以仓库根目录为基准；原生源码基路径为 `native-android/app/src/main/java/com/formularone/nativeapp/`。

### Task 0：重新设计 App 信息架构与交互

**文件与交付：**
- 设计依据：`docs/plans/2026-10-27-native-app-ux-design.md`
- 后续新增流程与原型源文件：`docs/design/native-app/`
- 预览截图存入被忽略的 `artifacts/native-android/design/`

**步骤：**
1. 以“查看当前比赛周末”为主要任务，重组赛事、榜单、资料和我的四个主入口。
2. 绘制赛事首页、赛历、比赛概览、场次成绩、圈速对比、积分榜、资料和我的八个关键页面的低保真流程。
3. 制作可点击原型，验证返回恢复、场次切换、底部面板、加载/失败/离线和权限状态；原型示例明确标记。
4. 确定代表性页面的视觉稿与原生组件规格，沿用现有品牌 token 和图表规范。
5. 结合用户对具体原型的反馈修订页面结构，再开始对应的 Compose 页面实现。构建环境和接口核查可以先行。

**验收：**从赛事首页到正赛成绩不超过两次主要点击；日常成绩查询不需要横向拖大表；无多层同类 Tabs；所有主操作可触屏完成。记录原型反馈与待验证点，不将设计稿当作已运行 APK。

### Task 1：确认构建环境、接口和数据样本

**文件：**
- 新建 `docs/native-android-setup.md`
- 新建 `docs/native-android-api-contract.md`
- 新建 `native-android/app/src/test/resources/fixtures/season-races.json`
- 新建 `native-android/app/src/test/resources/fixtures/race-results.json`
- 新建 `native-android/app/src/test/resources/fixtures/qualifying-results.json`

**步骤：**
1. 检查已有 `local.properties` 中的 SDK 目录是否可用，确认兼容的 JDK、SDK、模拟器或真机与 Gradle Wrapper。
2. 从官方资料确定兼容的稳定 Kotlin、AGP、Gradle、Compose 与 SDK 组合，固定依赖版本；不直接复制 Capacitor 工程的版本配置。
3. 核对赛程、正赛和排位接口的请求、响应、身份要求、分页、限流及真实可达性。
4. 保存不含账号、令牌或私有数据的固定测试样本，覆盖普通周末、冲刺周末和未来赛事。
5. 文档列明可用环境、接口权限和仍未验证的条件。

**验收：**明确可执行的构建路径；核心接口契约有真实样本。环境未就绪时，报告具体缺项，不把写好的源码描述为可安装软件。

### Task 2：创建原生工程与主题

**文件：**
- 新建 `native-android/settings.gradle.kts`、`build.gradle.kts`、`gradle.properties`、`gradle/libs.versions.toml`
- 新建 Gradle Wrapper、`native-android/app/build.gradle.kts`、`app/src/main/AndroidManifest.xml`
- 新建源码 `MainActivity.kt`、`FormularOneApp.kt`、`ui/navigation/AppNavigation.kt`
- 新建源码 `ui/theme/Color.kt`、`Theme.kt`、`Type.kt` 与 `app/src/main/res/values/strings.xml`
- 必要时修改根 `.gitignore`，排除 SDK 本地路径、Gradle 缓存、APK、签名材料与本地配置。

**步骤：**
1. 使用 ComponentActivity 与 Compose 创建应用，设置 INTERNET 权限和 HTTPS 网络策略。
2. 从 `src/styles/design-tokens.css` 映射品牌红、背景、文字和车队色；字体检查中文覆盖和使用许可。
3. 实现赛程入口与详情导航骨架，使用系统返回、状态栏、安全区域和系统主题。
4. 构建 APK，验证核心入口没有 Capacitor、BridgeActivity 或 WebView 依赖。

**验收：**应用可以独立启动；窗口使用原生界面；中文显示正常。

### Task 3：实现赛程与成绩数据层

**文件：**
- 新建源码 `data/remote/F1Api.kt`、`data/remote/dto/RaceDtos.kt`
- 新建源码 `data/repository/RaceRepository.kt`、`data/repository/DefaultRaceRepository.kt`
- 新建源码 `model/Race.kt`、`model/Classification.kt`、`data/mapper/RaceMapper.kt`
- 新建 `app/src/test/java/com/formularone/nativeapp/data/RaceMapperTest.kt`、`RaceRepositoryTest.kt`

**步骤：**
1. 先用固定样本写失败测试：时间与时区、退赛状态、未知时间、字符串数字、重复车手、不完整分页。
2. 实现 DTO、严格映射、Repository 和可替换的网络客户端；保留官方积分和名次，不在界面自行推导。
3. 加入请求取消、超时、有上限的重试；尊重 429/Retry-After，401/403 不循环重试。
4. 验证乱序响应不会覆盖用户刚切换的赛季或比赛。

**验收：**测试通过；网络错误与空列表可以区分；没有未验证的静默样例回退。

### Task 4：实现第一条原生使用路径

**文件：**
- 新建源码 `ui/schedule/ScheduleScreen.kt`、`ScheduleViewModel.kt`
- 新建源码 `ui/race/RaceDetailScreen.kt`、`RaceDetailViewModel.kt`、`ClassificationList.kt`
- 新建源码 `ui/common/LoadState.kt`、`LoadStateContent.kt`
- 新建 `app/src/test/java/com/formularone/nativeapp/ui/ScheduleViewModelTest.kt`、`RaceDetailViewModelTest.kt`
- 新建 `app/src/androidTest/java/com/formularone/nativeapp/RaceJourneyTest.kt`

**步骤：**
1. 先测试加载成功、失败后重试、未来赛事尚无成绩、返回列表保留选择与位置等状态转换。
2. 按 Task 0 确定的设计实现赛事首页与赛历，打开赛事后展示概览；成绩页使用独立场次选择器和原生成绩列表，不复制网站的多层 Tabs 和宽表格。
3. 将时间格式化和数据排序放到可测试的 Kotlin 逻辑中，避免堆进 Composable。
4. 对小屏、横屏、大字体、深浅主题和屏幕阅读器检查布局与可访问性。

**验收：**可以用真实数据走完整条路径；无成绩不误报接口故障；可返回、重试，且文字和控件不重叠。

### Task 5：公开数据缓存和设置

**文件：**
- 新建源码 `data/local/F1Database.kt`、`RaceDao.kt`、`CachedRaceEntity.kt`
- 新建源码 `data/settings/AppPreferences.kt`
- 新建 `app/src/test/java/com/formularone/nativeapp/data/CachePolicyTest.kt`
- 新建 `app/src/androidTest/java/com/formularone/nativeapp/data/RaceCacheTest.kt`

**步骤：**
1. 测试赛季/轮次缓存隔离、过期行为和网络更新失败后的回退。
2. 缓存公开赛程与成绩，展示更新时间和离线提示，避免把过期缓存标成实时结果。
3. 保存主题和赛季偏好，处理旋转、重启与后台恢复。

**验收：**已有缓存时断网仍可查询；首次安装断网有明确提示；不会把其他赛事缓存混入当前结果。

### Task 6：验证与交付试用包

**文件：**
- 新建 `docs/qa/native-android-mvp.md`
- 截图与 APK 存入被忽略的 `artifacts/native-android/`，在 QA 文档记录路径和 SHA-256。

**命令（PowerShell，仓库根目录；在 Wrapper 和环境就绪后执行）：**

```powershell
Set-Location -LiteralPath 'native-android'
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
.\gradlew.bat :app:connectedDebugAndroidTest
```

**验收：**
- 单元测试、Lint 和 Debug 构建通过；设备测试必须记录实际运行结果。
- 真机或模拟器完成安装、打开赛程、查看成绩、返回、断网、重连和重启检查。
- 检查 Logcat 中崩溃与网络异常；保存代表性屏幕截图。
- 设备上的 App 核心页面由 Compose 绘制，网络请求读取数据接口。
- 无设备时只能交付已验证的构建和未完成的设备检查项，不能声称真机验收通过。

## 5. 后续阶段

1. **基础功能扩展：**当季积分榜、车手/车队/赛道资料和搜索已纳入首个切片；后续扩展完整历史档案与更细的资料字段。
2. **账号与权限：**复用现有 Supabase 用户体系；验证注册、登录、刷新、退出、密码恢复、App Links/回调以及验证码兼容性。必要的身份验证可以使用系统认证页面，但不能用它替代核心 App 界面，也不能禁用现有验证码或权限校验。
3. **会员分析：**接入受保护的天气、预测和 FastF1 分析；测试切换用户、过期会话、退出中断下载、私有缓存清理。未经确认不持久化会员原始分析。
4. **原生图表：**先做一个圈速对比原型，验证数据量、缩放、选择与低端设备表现，再扩展轮胎策略、遥测等图表。不通过嵌入 ECharts 网页实现；遵循现有 `docs/chart-guidelines.md` 的可读性和状态规范。
5. **正式发布：**独立确定移动端 versionName/versionCode、包名、签名、隐私说明、分发渠道和发布验证；不把网站版本号和原生试用包版本混为一谈。
6. **iPhone：**Android 试用体验验证后，另写 SwiftUI 实施计划，复用已明确的数据契约、视觉语义和测试场景。

## 6. 发布与工作区约束

- 当前已实现并构建独立的 Android 原生公开数据试用版；未提交、推送或发布。现有 Web 运行源码未在本批中修改。
- 默认只做本地修改和验证；提交、推送和发布遵守仓库明确授权规则，不自动执行。
- 不读取或复制 `.env` 中的秘密到 Android 包；公开客户端配置与服务端秘密必须明确区分。禁止客户端包含 service-role key。
- Android 使用结构化日志，不输出令牌、密码和私有响应；Web 如需改动继续使用 `src/utils/logger.ts`。
- 第一阶段不修改现有 Web 源码。若后续触及 Web 接口或功能，先执行相关项目技能与契约审查，并按变更范围运行 Web 单测、生产构建和浏览器 QA。

## 7. 参考资料

- [Android 官方架构建议](https://developer.android.com/topic/architecture/recommendations)
- [Jetpack Compose 原生 UI](https://developer.android.com/develop/ui/compose)
- [Android Studio 安装与环境要求](https://developer.android.com/studio/install)

工期在交互原型范围与 Task 1 环境/接口条件明确后再估算；先交付可审阅的原型，再交付可安装的真实数据查询版本，不以完成全部网站功能作为第一次试用的前提。
