# FrankPitwall Android 原生工程环境

独立工程位于 `native-android/`，不运行或嵌入现有 React 页面；现有 Capacitor `android/` 工程保留。

## 本机已核实

- Android Studio：`D:/DeveloperTools/AndroidStudio/`。
- JDK：Android Studio `jbr`，OpenJDK 21.0.10。
- SDK：`C:/Users/FrankFan/AppData/Local/Android/Sdk/`。
- SDK platforms：36、36.1；build-tools 包含 35.0.0。
- 已有 Gradle 8.14.3 distribution；当前项目的依赖缓存单独存入被忽略的 `.cache/native-gradle/`。
- 受限命令环境无法连接 ADB；在允许本机进程通信的执行环境中，ADB 已成功启动，当前连接设备 0 台、已配置 AVD 0 个，SDK 中没有安装模拟器系统镜像。没有执行安装、启动或设备截图验证。

## 工具版本

AGP 8.13.0、Gradle 8.14.3、Kotlin 与 Compose Compiler 插件 2.2.20、Compose BOM 2025.10.00；compileSdk/targetSdk 36，minSdk 26。首次构建需从 Google Maven / Maven Central / Gradle Plugin Portal 获取依赖，不在项目中保存仓库口令。

该组合使用已存在的 SDK 和 Gradle，不修改全局 Android Studio 配置。[AGP 官方兼容说明](https://developer.android.com/build/releases/agp-8-13-0-release-notes)确认 Gradle 最低 8.13、JDK 最低 17。[Compose Compiler 配置](https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler)要求其插件与 Kotlin 使用相同版本。

## 构建

从仓库根目录运行：

```powershell
python scripts/prepare-native-public-config.py
pwsh -File scripts/native-android.ps1 -Task verify -JavaHome 'D:\DeveloperTools\AndroidStudio\jbr'
```

其他机器通过 `-JavaHome`、`-SdkRoot` 指定自己的路径。`local.properties`、Gradle 缓存和 build 输出均不加入版本控制。`-Task test` 仅跑单元测试，`-Task build` 仅构建 Debug APK；`-Offline` 仅适用于依赖已完整缓存的环境。移动资源目录后可使用 `-Clean` 先清理本工程的生成目录，避免旧资源索引干扰。

Gradle 需要本机进程通信，受限网络环境可能无法连接 daemon；此时须在允许本机进程通信的执行环境运行，不修改系统防火墙或关闭安全保护。

输出：`native-android/app/build/outputs/apk/debug/app-debug.apk`。只有实际构建成功后才能将它作为可安装产物交付；安装、运行与设备截图另行验证。

公开配置脚本只复制三个白名单字段，拒绝 service-role/secret key，不输出字段值。生成文件被 Git 忽略；缺少配置的构建仍可浏览 Jolpica 公开资料，账号功能不可用。APK 中的 anon/publishable key 只能提供公开身份，会员访问仍由服务端会话和 RLS 决定。

0.1 历史记录见 [首版 QA](qa/native-android-mvp.md)，本批功能与验收边界见 [0.2 功能 QA](qa/native-android-features.md)。APK 保存在被忽略的 `artifacts/native-android/`。

2026-10-29 已完成 0.2.0 的 47 项测试、Lint、Debug 构建及签名校验。试用包为 `artifacts/native-android/FrankPitwall-0.2.0-debug.apk`；仍需连接设备验证实际运行、验证码与真实账号。
