# 公开接口快照

2026-10-27 从 Jolpica F1 公共接口以 `FrankPitwall-Android/0.1.0` User-Agent 获取。所有记录为公开赛程、成绩与积分，不含账号或会员数据。

- `2025.json?limit=100` → 24 场赛事。
- `2025/16/results.json?limit=100` → 20 条正赛成绩。
- `2025/16/qualifying.json?limit=100` → 20 条排位成绩。
- `2025/driverStandings.json?limit=100` → 21 位赛季车手。
- `2025/constructorStandings.json?limit=100` → 10 支车队。

基础 URL：`https://api.jolpi.ca/ergast/f1/`。测试离线使用这些快照；它们位于测试资源，不能作为生产数据回退，也不会打包进 APK。
