# FrankPitwall 品牌标识

用于 App 顶栏的横向字标，以及可单独使用的 FP 图形标识。设计延续现有网站的红黑配色，采用独立绘制、相互连接的 F/P 几何字母；不用卡片或外框包裹品牌。

- `frankpitwall-logo-light.svg`：浅色界面，完整字标。
- `frankpitwall-logo-dark.svg`：深色界面，完整字标。
- `frankpitwall-mark-light.svg` / `frankpitwall-mark-dark.svg`：不含文字的独立 FP 图形。
- `frankpitwall-logo.png`：透明背景 PNG 字标，宽 956px。
- `frankpitwall-mark.png`：透明背景 PNG 图形，宽 256px。

SVG 背景透明，字标已转换为路径，不依赖使用设备安装字体。原型顶栏显示尺寸为 145 × 25 px，不增加内容横向留白。

用户要求 F/P 联动更强：两个字母共用左侧竖笔，上横和中横连续接入右侧 P 的闭合环；连接处采用相同角度的斜切，形成一个完整轮廓。红色部分读作 F，右侧闭合环与共用笔画构成 P。保留反白空间以维持小尺寸辨识度。

图形的 F 使用品牌红，P 的右侧闭合环及 Frank 使用界面文字色，Pitwall 使用对应主题的可读红色。品牌拼写固定为 `FrankPitwall`。

生成脚本 `generate-logo.py` 使用当前工作站已有的 Bahnschrift 字体绘制字标路径，不附带或分发原始字体文件。可通过 `--font` 指定其他支持的本地字体后重新生成。

更新资产后运行 `node docs/design/native-app/brand/export-logo.mjs`，同步导出 PNG 和本地评审预览。

这些是品牌设计资产，尚未生成 Android Adaptive Icon 或启动图。
