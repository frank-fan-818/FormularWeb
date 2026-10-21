# 账号表单人机验证

登录、注册和申请密码重置支持 Cloudflare Turnstile。普通浏览、游客入口、已有会话刷新、退出和邮件回调不添加验证。
验证组件只在账号表单中加载。Vite 构建时未设置 `VITE_TURNSTILE_SITE_KEY` 会保持原有表单行为；这不是服务端保护。

## 配置和启用顺序

1. 在 Cloudflare Turnstile 创建 Managed（托管）组件，允许 `frankpitwall.com`。使用其他访问域名时也需加入对应主机名，不填协议和路径。Pre-clearance 关闭。
2. 在 Vercel 对应环境设置公开变量 `VITE_TURNSTILE_SITE_KEY`，值为组件的 Site Key，重新构建并部署。前端只需要公开 Site Key。
3. 在支持验证的新页面上线并确认组件可完成验证之后，再进入 Supabase → Authentication → Bot and Abuse Protection，启用 CAPTCHA，选择 Turnstile，并将同一组件的 Secret Key 直接填入 Supabase。不要将 Secret Key 放在 `VITE_*`、源码、聊天或日志中。
4. 服务端保护启用后，再验证三个表单均能正常提交，并确认不带令牌或使用无效令牌的直接 Auth 请求被 Supabase 拒绝。仅显示前端组件不能证明服务端保护生效。

请保留邮箱验证和现有 PKCE 回调配置。启用 Supabase CAPTCHA 会影响仍打开的旧页面或未升级客户端，用户可能需要刷新页面；不要在前端上线前打开生产开关。

## 本地验证

将公开 Site Key 放在未被版本控制的 `.env.local` 中。测试环境可以使用 Cloudflare 官方测试 Site Key，但只能搭配非生产 Supabase 项目的测试 Secret Key；禁止在生产项目使用测试密钥。
令牌仅保存在当前表单内存中；提交后重建验证组件，避免重复使用。错误、过期、超时都会清除令牌并禁用提交，用户可重新验证。第三方脚本加载失败有超时提示和重试入口。

生产 CSP 仅给 `script-src` 和 `frame-src` 增加 `https://challenges.cloudflare.com`，不增加任意脚本来源或 `unsafe-eval`。

## 验收

- `/login`、`/register`、`/forgot-password` 在验证前禁止提交；验证后请求携带令牌。
- 认证失败后令牌不复用；过期、超时、网络错误后可重新验证。
- 在 1440 x 900、768 x 1024、375 x 812 检查组件、提示和按钮，无横向溢出。
- 游客浏览不加载 Turnstile；已登录用户的会话刷新、退出不需要新验证。
- 不记录 Siteverify 的 Secret Key、验证令牌、口令或恢复链接。自动化夹具通过不能替代真实 Cloudflare/Supabase 生产校验。

参考：[Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)、[Cloudflare 组件接入](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)、[CSP 配置](https://developers.cloudflare.com/turnstile/reference/content-security-policy/)。
