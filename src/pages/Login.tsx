import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { authApi, getAuthErrorMessage } from '@/api/auth';
import { AuthCard } from '@/components/auth/AuthCard';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getAuthReturnPath } from '@/utils/authNavigation';
import { isSupabaseConfigured } from '@/utils/supabase';

interface LoginFormValues {
  email: string;
  password: string;
}

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: sessionLoading } = useAuthSession();
  const [submitting, setSubmitting] = useState(false);
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
      await authApi.signOut();
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
      intro={session ? '当前账号已登录。' : '使用邮箱登录。赛事数据无需账号也可浏览。'}
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
        <Form<LoginFormValues>
          name="email-login"
          layout="vertical"
          size="large"
          requiredMark={false}
          disabled={!isSupabaseConfigured || sessionLoading}
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' },
              { max: 254, message: '邮箱地址过长' },
            ]}
          >
            <Input type="email" prefix={<MailOutlined />} placeholder="name@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="输入密码" autoComplete="current-password" />
          </Form.Item>
          <div className="auth-card__helper-row">
            <Link className="auth-card__text-link" state={location.state} to="/forgot-password">忘记密码？</Link>
          </div>
          <Form.Item noStyle>
            <Button className="auth-card__primary" type="primary" htmlType="submit" block loading={submitting || sessionLoading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      )}
    </AuthCard>
  );
};

export default Login;
