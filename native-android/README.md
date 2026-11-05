# FrankPitwall · Kotlin Android

独立的 Android 原生客户端，使用 Kotlin + Jetpack Compose。核心界面没有 WebView、Capacitor、React 或网站页面加载依赖。

## 当前功能

- **赛事：**按真实接口显示当前赛季、比赛周末和完整赛历，支持历史赛季切换。
- **成绩：**正赛、排位及有数据的冲刺场次；官方名次、时间/状态、积分，支持查看车手表现。
- **榜单：**车手和车队积分，查看对应档案。
- **资料：**当季车手、车队、赛道的搜索与下钻。
- **我的：**系统/浅色/深色主题，UTC 与北京时间，偏好设置保存在设备。
- 公开数据按赛季、分站、场次缓存；更新失败时明确标记缓存时间。不会用示例数据替代真实响应。

视觉沿用已确认的连体 FP 标识、FrankPitwall 字标、品牌红和紧凑列表；页面只有一层侧边留白，没有多层卡片框。

## 运行与检查

环境和构建方式见 [环境说明](../docs/native-android-setup.md)。从仓库根目录运行：

```powershell
pwsh -File scripts/native-android.ps1 -Task verify -JavaHome 'D:\DeveloperTools\AndroidStudio\jbr'
```

检查内容：原生单元测试、Android Lint、Debug APK。Debug 构建不代表已在设备上完成安装或性能验收。

## 代码结构

- `app/src/main/java/com/formularone/nativeapp/data/`：HTTPS、解析、公开缓存、DataStore 偏好。
- `.../model/`：共享领域模型与纯数据规则。
- `.../ui/`：ViewModel、显式页面栈、Compose 页面与组件。
- `app/src/main/res/`：原生矢量 Logo、图标及复用的车手头像。
- `app/src/test/`：数据完整性、缓存与切换请求的测试。

接口契约见 [公共数据接入](../docs/native-android-api-contract.md)。目前只接入公开数据，不包含会员登录、私有遥测、预测、新闻、完整历史档案或 iOS 客户端。

生产代码中没有演示赛事数据。浏览器评审原型仍独立保留在 `docs/design/native-app/`，其示例数据不会打包到本工程。

版本 `0.1.0` 为原生试用版本，独立于网站版本。未授权提交、推送或正式发布。
