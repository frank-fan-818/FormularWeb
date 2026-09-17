import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { getAuthErrorMessage } from '@/utils/authErrors';
import { AuthCard } from '@/components/auth/AuthCard';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getAuthReturnPath } from '@/utils/authNavigation';
import { isSupabaseConfigured } from '@/utils/supabaseConfig';

interface LoginFormValues {
  email: string;
  password: string;
}

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: sessionLoading, enterGuest, leaveGuest, error: sessionError, retry } = useAuthSession();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const returnPath = getAuthReturnPath(location.state);
  const successMessage = searchParams.get('verified') === '1'
    ? '邮箱验证已完成，现在可以登录。'
    : searchParams.get('reset') === '1'
      ? '密码已更新，请使用新密码登录。'
      : null;

  const handleSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { authApi } = await import('@/api/auth');
      await authApi.signIn(values.email, values.password);
      navigate(returnPath, { replace: true });
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { authApi } = await import('@/api/auth');
      await authApi.signOut();
      leaveGuest();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      eyebrow="ACCOUNT ACCESS"
      title={session ? '账号已连接' : '欢迎回来'}
      intro={session ? '已解锁圈速、遥测、策略分析与预测。' : '登录，进入你的 F1 数据中心。'}
      footer={!session ? <span>还没有账号？<Link state={location.state} to="/register">创建账号</Link></span> : undefined}
    >
      {!isSupabaseConfigured ? (
        <Alert
          className="auth-card__alert"
          type="warning"
          showIcon
          message="身份服务尚未配置"
          description="公开赛事数据仍可浏览；配置 Supabase 环境变量后即可启用登录。"
        />
      ) : null}
      {sessionError ? <Alert className="auth-card__alert" type="warning" message={sessionError} action={<Button onClick={retry}>重试</Button>} /> : null}
      {successMessage ? <Alert className="auth-card__alert" type="success" showIcon message={successMessage} /> : null}
      {errorMessage ? <Alert className="auth-card__alert" type="error" showIcon message={errorMessage} /> : null}

      {session ? (
        <div className="auth-card__session">
          <div className="auth-card__session-email">{session.user.email}</div>
          <Button className="auth-card__primary" type="primary" block onClick={() => navigate(returnPath, { replace: true })}>
            进入数据中心
          </Button>
          <Button block danger loading={submitting} onClick={() => void handleSignOut()}>
            安全退出
          </Button>
        </div>
      ) : (
        <form
          name="email-login"
          className="auth-login-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting || sessionLoading || !isSupabaseConfigured) return;
            const fields = new FormData(event.currentTarget);
            void handleSubmit({ email: String(fields.get('email') || ''), password: String(fields.get('password') || '') });
          }}
        >
          <fieldset disabled={!isSupabaseConfigured || sessionLoading || submitting}>
            <label htmlFor="login-email">邮箱</label>
            <input id="login-email" name="email" type="email" required maxLength={254} placeholder="name@example.com" autoComplete="email" />
            <label htmlFor="login-password">密码</label>
            <div className="auth-login-form__password">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} required maxLength={128} placeholder="输入密码" autoComplete="current-password" />
              <button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? '隐藏' : '显示'}</button>
            </div>
          <div className="auth-card__helper-row">
            <Link className="auth-card__text-link" state={location.state} to="/forgot-password">忘记密码？</Link>
          </div>
            <Button className="auth-card__primary" type="primary" htmlType="submit" block loading={submitting || sessionLoading}>
              登录
            </Button>
          </fieldset>
        </form>
      )}
      {!session ? (
        <div className="auth-card__access-options">
          <div className="auth-card__access-comparison">
            <div><strong>游客浏览</strong><span>赛历 · 比赛结果 · 积分榜</span></div>
            <div><strong>免费注册用户</strong><span>全部基础数据 + 圈速 · 遥测 · 策略 · 预测</span></div>
          </div>
          <Button block disabled={sessionLoading} onClick={() => {
            enterGuest();
            navigate(returnPath, { replace: true });
          }}>以游客身份浏览</Button>
        </div>
      ) : null}
    </AuthCard>
  );
};

export default Login;
