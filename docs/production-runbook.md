# 生产发布与回滚手册

本手册用于 Web 1.0 发布候选。2026-10-21 当前生产版本仍为 `0.24.0`；源码版本准备不代表已经发行。
每次操作都需要保存对应提交和生产证据。当前验收记录见 `docs/plans/2026-10-20-v1-release-p0.md`。

## 发布门禁

1. 对拟发布的最终提交执行 `npm ci` 和 `npm run quality:check`，确认 Linux CI 全部通过。
2. 在部署记录中填写：提交 SHA、版本、部署标识、数据库迁移版本、发布负责人、故障处理负责人、上一个可用部署。
3. 根据 `docs/release-checklist.md` 使用专用测试账号检查注册、登录、恢复密码、刷新页面和退出；检查 Supabase 回调地址、匿名读写边界、会员预测读取和私有 Storage。不要将测试口令或服务密钥写入报告。
4. 抽样核对当前赛季赛历、已结束比赛成绩、练习赛、FastF1 和预测生成时间。空数据要与上游实际状态一致，不能以夹具测试代替抽样。
5. 记录最近同步任务的成功时间与失败处理人，再发布候选部署。

### 2026-10-20 已核实的生产迁移

- 项目：`zmihswdvixurhjjsazrl`，与 Vercel 的生产 `VITE_SUPABASE_URL` 一致。
- 已补应用 `scripts/sql/2026-08-11-error-log-diagnostics.sql`，修复生产缺失的诊断字段。
- 已应用 `supabase/migrations/20261018000100_prediction_evaluations.sql`，原失败的预测同步任务重跑成功。
- 已应用并重复验证 `supabase/migrations/20261020000100_release_access_hardening.sql`。
- 执行 `supabase db query --linked --file scripts/sql/verify-release-access.sql`，确认游客、匿名登录、会员和服务端角色边界。
- 不要为绕过缺表错误创建公开的 `exec_sql` RPC；使用已审查的迁移。

### 2026-10-21 注册与恢复邮件验收

维护者已完成 Cloudflare 发信域名验证，在 Supabase 直接保存 Resend SMTP 凭据及新域名回调地址。
真实新账号注册、验证邮件、登录和刷新已通过；在原浏览器打开最新恢复链接、设置不同新密码和重新登录也已通过。
当前 PKCE 恢复需要使用申请时的同一浏览器和网站域名。再次申请需遵守服务端发送间隔，默认至少一分钟。
不得将 SMTP 密码、API key、恢复链接或浏览器会话加入报告；保持邮箱验证开启。
详细配置及验收范围见 `docs/smtp-production-setup.md`。

## 部署后只读检查

构建会生成 `/release.json`，包含版本与内容派生的 buildId，不包含环境变量、凭据或本机路径。
其缓存规则为 `no-store`；哈希资源缓存一年，Service Worker 每次重新验证。

PowerShell：

```powershell
$env:PRODUCTION_URL = 'https://frankpitwall.com'
$env:EXPECTED_RELEASE_VERSION = '1.0.0'
npm run deployment:verify:live
```

将 `PRODUCTION_URL` 替换为实际生产 HTTPS 根地址。脚本只执行同源 GET，不跟随重定向，
不登录、不写数据、不发送消息；验证首页、登录深链、安全头、发布身份、SW 缓存、
缺失静态资源 404、公开 FastF1 路径阻断，以及本年度赛历代理和哈希脚本响应。
原始响应与异常不进入报告，证据保存在被 Git 忽略的 `artifacts/production/verification.json`。

`availability: unreachable` 表示检查环境没有成功读到首页，不能据此判定生产安全头缺失。
`reachable` 但某项失败时应按相应检查定位。该探针不验证数据库 RLS、真实登录链路、
私有数据质量、赛后同步时效或生产实用户性能；这些仍需要上面的专项证据。

## 运行监控

合并到默认分支后，`.github/workflows/production-health.yml` 每六小时执行一次，也可手动运行。
在仓库 Actions Variables 设置 `PRODUCTION_URL` 和 `EXPECTED_RELEASE_VERSION`；期望版本为空时
只能验证身份格式，无法发现部署版本落后。发布或回滚后务必同步期望版本。

故障处理负责人需要启用并实际测试 GitHub Actions 失败通知；本工作流只产生失败状态、
检查摘要与保留 14 天的证据，不代表通知接收人已经配置。不得只凭工作流文件宣称告警闭环。
检查失败后先确认地址、网络、生产版本和上游服务；数据同步失败按现有同步任务报告定位。

## 回滚

1. 发布前记录上一个可用部署及其 SHA、版本，并确认仍可恢复。没有明确目标时不要以“重新构建旧分支”代替已验证部署。
2. 发生登录不可用、权限泄露、数据错误或持续探针失败时，由发布负责人恢复该已知可用部署。
3. 数据库迁移单独评估兼容性；前端回滚不会撤销数据库变化。禁止未经检查删除数据或反向执行迁移。
4. 把 `EXPECTED_RELEASE_VERSION` 更新为恢复版本，重新运行线上检查；用两个已打开的标签页检查升级、导航与登录状态。
5. 再次核对真实数据和访问边界，记录故障时间、影响范围、恢复部署与验证结果。保留故障部署的日志以定位根因。

2026-10-20 已执行生产域名回滚与恢复演练：

- 从 `0.24.0 / dpl_3ReqGbzydeK1BaUPWPiKy7XMPgtj` 回滚至
  `0.23.1 / dpl_3QiFGqFN8p9Z61Qu4tzR3pSUzyJG`，读取域名记录确认切换成功。
- 随后 promote 恢复原 `0.24.0` 部署，读取域名记录确认恢复成功；未执行数据库回滚。
- 恢复后健康检查全部通过：
  https://github.com/frank-fan-818/FormularWeb/actions/runs/39429693278。
- 发布与故障负责人为 `frank-fan-818`，已获维护者确认。GitHub 设置已开启 Actions 的站内与邮件失败通知，维护者已确认收到原失败任务的提醒。
- 仓库监控变量目前为 `PRODUCTION_URL=https://frankpitwall.com` 及 `EXPECTED_RELEASE_VERSION=0.24.0`。只有 1.0 实际部署后才改为 `1.0.0`。
