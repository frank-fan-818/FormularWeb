# FormularOneWeb 开发规则

## 1. 项目架构

### 技术栈
React 18 + TypeScript + Vite + Ant Design 5 + Zustand + React Router v6

### 目录结构
```
src/
├── api/        # API 接口（ergast.ts, supabase.ts）
├── hooks/      # 自定义 Hooks
├── pages/      # 页面组件
├── types/      # TypeScript 类型
├── store/      # Zustand 状态管理
└── utils/      # 工具函数
```

---

## 2. 核心规范

### 2.1 必须遵守
- ✅ 可复用逻辑提取到 `hooks/` 目录
- ✅ API 调用统一在 `api/` 目录，禁止组件直接调用外部 API
- ✅ 类型定义统一在 `types/` 目录
- ✅ 敏感信息放 `.env`，且 `.env` 必须在 `.gitignore` 中

### 2.2 禁止事项
- ❌ 组件中直接使用 `console.log`
- ❌ JSX 中写复杂逻辑
- ❌ 重复定义相同类型
- ❌ 硬编码 API 密钥

---

## 3. 代码模板

### 组件模板
```typescript
import { FC } from 'react';
import { useAppStore } from '@/store';
import { useXxx } from '@/hooks';

interface Props {
  // props 定义
}

const Component: FC<Props> = ({ prop }) => {
  const { currentSeason } = useAppStore();
  const { data, loading } = useXxx();
  
  return <div>{/* JSX */}</div>;
};

export default Component;
```

### Hook 模板
```typescript
import { useState, useEffect } from 'react';

export function useXxx(param: string) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // 数据获取逻辑
  }, [param]);
  
  return { data, loading };
}
```

---

## 4. 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `RaceDetail.tsx` |
| Hooks | camelCase | `useSeasonData.ts` |
| 工具函数 | camelCase | `formatDate.ts` |
| 类型/接口 | PascalCase | `Driver`, `Race` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL` |

---

## 5. 提交前检查清单

- [ ] `npx tsc --noEmit` 编译通过
- [ ] 无未使用的变量/导入
- [ ] Hooks 只在组件最上层调用
- [ ] 敏感信息未泄露

---

## 6. 常用导入

```typescript
import { useAppStore } from '@/store';
import { seasonApi } from '@/api/ergast';
import type { Driver } from '@/types';
import { useSeasonData } from '@/hooks';
```

---

*版本: v1.1 | 更新: 2026-04-09*
