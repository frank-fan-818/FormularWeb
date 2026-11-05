# FrankPitwall Android 原生试用版验证

- 日期：2026-10-27（Asia/Shanghai）。
- 原生版本：`0.1.0` / versionCode `1`，applicationId `com.formularone.nativeapp`。
- 平台基线：minSdk 26（Android 8.0），targetSdk/compileSdk 36。
- 工程：`native-android/`，Kotlin + Jetpack Compose；保留现有 Web 与 Capacitor 工程。
- 范围：公开赛历、比赛周末、正赛/排位/冲刺成绩、积分榜、当季资料搜索、资料下钻、主题/时区与公开缓存。

## 验证结果

最终命令：

```powershell
pwsh -File scripts/native-android.ps1 -Task verify -JavaHome 'D:\DeveloperTools\AndroidStudio\jbr' -Offline
```

- `testDebugUnitTest`：18 项，0 失败、0 错误、0 跳过。
- `lintDebug`：通过，0 错误；1 条非阻塞 `ObsoleteSdkInt` 提示，来自资源移动后遗留的空 `mipmap-anydpi-v26` 目录。实际启动图标位于 `mipmap-anydpi`。
- `assembleDebug`：成功。最终这轮 Gradle 验证耗时 54 秒；首次依赖准备和 Lint 冷启动较慢。
- `apksigner verify --verbose`：通过，APK Signature Scheme v2 已验证。此为 Debug 签名，不作为正式分发签名。
- APK 内容检查：没有 HTML、JS、MJS、CSS 资源，也没有测试快照；核心 UI 不加载网站。
- Manifest badging：应用名称 FrankPitwall、原生 applicationId 和 SDK 基线与上述一致。
- `.vercelignore` 增加 `native-android`；`node scripts/verify-deployment-config.mjs` 通过，避免原生源码和本地产物混入 Web 部署。
- `git diff --check` 通过。SDK 本地配置、APK、构建缓存和证据目录均被忽略。

## 测试覆盖

- 赛程 UTC 起点、未知时间、分页不完整、重复分站。
- 官方退赛状态及名次不被伪造；赛季结束选择最后一站。
- 公开缓存防重复请求、按赛季隔离、强制刷新失败回退及过期标识。
- 取消不能被吞成缓存成功；坏响应不能覆盖有效缓存。
- 切换赛季后，旧请求不能覆盖新的选择。
- 成绩尚未发布和网络失败的状态区分。
- 嵌套进入另一场比赛后，返回恢复原比赛和原场次；已通过回归测试复现并修复。
- 真实 2025 赛季快照：24 场赛历、20 条正赛和排位、21 位车手与 10 支车队。
- 同赛季转队保留所有车队关联；积分榜缺页必须失败。

## 公开接口连通性

在本机桌面脚本上，以 App 相同 User-Agent 验证 Jolpica HTTPS GET：

- 2025 赛历、意大利站正赛/排位、车手/车队积分均返回 200，保存为离线测试资源。
- 默认 2026 赛历：200，23 场；车手积分：200，23 位；车队积分：200，11 支。

这是桌面接口检查，不能替代 Android 设备上的联网验证。生产代码只读取真实响应及经校验的缓存，不导入这些测试快照。

## 试用文件

- 构建原件：`native-android/app/build/outputs/apk/debug/app-debug.apk`。
- 整理后的文件：`artifacts/native-android/FrankPitwall-0.1.0-debug.apk`。
- 大小：12,203,265 bytes，约 12.2 MB。
- SHA-256：`69b38d6c3dd603b8b2db7e25c701aeb3fe49a5d65179cb48af6e6b376e9f28af`。
- 机器可读记录：`artifacts/native-android/build-record.json`。

## 未完成的设备与产品验收

允许本机进程通信后 ADB 正常启动，但当前设备数 0、AVD 数 0，SDK 未安装模拟器系统镜像。本次未安装、启动 APK，未取得原生截图或 Logcat，也没有声称以下项目通过：

- 真机完整主流程、横屏、小屏、200% 字号、TalkBack、键盘与系统返回。
- Android 上的网络可达性、断网/重连和真实设备性能。
- 进程死亡后的深层页面恢复；当前仅主题与时区持久化，列表保存与 ViewModel 状态需要设备验证。
- 会员登录、私有分析、原生图表、完整历史档案、iOS 客户端及商店发布。

本批类型为 `feat`，独立原生模块从首个试用版本 `0.1.0` 起步；没有改动 Web 的 `package.json` 版本。所有改动保留本地，未提交、推送、打标签或部署。
