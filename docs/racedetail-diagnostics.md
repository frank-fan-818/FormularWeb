# RaceDetail 数据流诊断手册

RaceDetail 的每次比赛访问都会生成一个 `flowId`。错误提示中的“诊断编号”就是该值；同一次访问产生的路由、请求、fallback、Hook 状态和渲染聚合事件都使用相同编号。

## 浏览器排查

在控制台中过滤诊断编号，例如 `flow-1`。结构化日志的重要字段：

- `operation`：发生问题的数据边界。
- `source`：`jolpica`、`supabase`、`fastf1_static`、`fia` 或 `react`。
- `outcome`：`succeeded`、`empty`、`degraded`、`failed`、`aborted` 或 `stale_ignored`。
- `reasonCode`：网络、超时、HTTP、校验、数据身份、404或Schema问题。
- `itemCount`：通过该边界的数据条数，不包含原始数据。

当前会话最近100条安全事件保存在 `sessionStorage` 的 `f1-diagnostic-trace-v1` 中。它只包含白名单标签、计数和耗时，不包含查询参数、Token、响应正文或错误堆栈。

## 定位顺序

1. `route_identity` 没出现：页面脚本尚未运行，先查构建、分片或路由。
2. 请求 `failed`：查网络、HTTP状态、超时和上游服务。
3. 请求成功但 `validation`：查API Schema与数据身份。
4. 主源 `degraded` 后 fallback 成功：页面处于降级状态，修主数据源但不应阻塞用户。
5. 数据成功但 `context_aggregate=blocked`：查Hook身份或Context聚合逻辑。
6. Context ready 后仍白屏：查 `react/render` 和全局异常。

## Supabase 查询

迁移 `scripts/sql/2026-08-11-error-log-diagnostics.sql` 后，可按诊断编号重建失败流：

```sql
select timestamp, operation, source, outcome, reason_code, duration_ms
from public.error_logs
where flow_id = '<diagnostic-id>'
order by timestamp asc;
```

远程表仍只允许已认证会话写入；不要为了匿名日志开放公共 INSERT 策略。
