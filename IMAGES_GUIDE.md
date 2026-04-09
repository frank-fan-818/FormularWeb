# F1 图片资源使用指南

## 当前状态

目前应用默认使用 **远程图片** 来自 f1db 仓库，确保应用能正常显示图片。

## 如何使用本地图片

如果你希望使用本地图片（提高加载速度、离线可用），请按以下步骤操作：

### 1. 准备图片资源

将车手头像和车队 Logo 放入对应的文件夹：

- 车手头像：`src/assets/drivers/`
- 车队 Logo：`src/assets/constructors/`

### 2. 图片命名规则

图片文件名必须与车手/车队的 `driverId` 或 `constructorId` 一致，格式为 PNG：

**车手头像示例：**
- `verstappen.png` (对应 max_verstappen)
- `hamilton.png` (对应 hamilton)
- `leclerc.png` (对应 leclerc)

**注意**：车手图片文件名使用的是**姓**，而不是完整的 driverId。

**车队 Logo 示例：**
- `red_bull.png`
- `ferrari.png`
- `mercedes.png`

### 3. 修改代码使用本地图片

在各个页面文件中，修改 `getDriverImage` 和 `getConstructorImage` 函数：

**修改前（使用远程图片）：**
```typescript
const getDriverImage = (driverId: string) => {
  const surname = driverId.split('_').pop() || driverId;
  return `https://raw.githubusercontent.com/f1db/f1db/main/src/images/drivers/${surname}.png`;
};
```

**修改后（使用本地图片）：**
```typescript
const getDriverImage = (driverId: string) => {
  const surname = driverId.split('_').pop() || driverId;
  try {
    return new URL(`../assets/drivers/${surname}.png`, import.meta.url).href;
  } catch (error) {
    return `https://raw.githubusercontent.com/f1db/f1db/main/src/images/drivers/${surname}.png`;
  }
};
```

**修改后（使用本地图片）：**
```typescript
const getDriverImage = (driverId: string) => {
  try {
    return new URL(`../assets/drivers/${driverId}.png`, import.meta.url).href;
  } catch (error) {
    return `https://raw.githubusercontent.com/f1db/f1db/main/public/images/drivers/photos/${driverId}.png`;
  }
};
```

需要修改的文件：
- `src/pages/DriverDetail.tsx`
- `src/pages/ConstructorDetail.tsx`
- `src/pages/Drivers.tsx`
- `src/pages/Constructors.tsx`
- `src/pages/Seasons.tsx`

### 4. 下载图片脚本

项目提供了下载脚本，可以自动从 f1db 仓库下载图片：

**使用 PowerShell 脚本（推荐）：**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/download-images-simple.ps1
```

如果网络下载失败，可以：
1. 手动访问 https://github.com/f1db/f1db/tree/main/public/images
2. 下载需要的图片
3. 放入对应的文件夹中

## 常用车手和车队 ID

### 车手 ID
- `max_verstappen` - 马克斯·维斯塔潘
- `perez` - 塞尔吉奥·佩雷兹
- `hamilton` - 刘易斯·汉密尔顿
- `russell` - 乔治·拉塞尔
- `leclerc` - 夏尔·勒克莱尔
- `sainz` - 卡洛斯·塞恩斯
- `norris` - 兰多·诺里斯
- `piastri` - 奥斯卡·皮亚斯特里
- `alonso` - 费尔南多·阿隆索
- `stroll` - 兰斯·斯托尔

### 车队 ID
- `red_bull` - 红牛
- `ferrari` - 法拉利
- `mercedes` - 梅赛德斯
- `mclaren` - 迈凯伦
- `alpine` - 阿尔派
- `aston_martin` - 阿斯顿·马丁
- `haas` - 哈斯
- `williams` - 威廉姆斯
