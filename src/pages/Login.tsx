import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { authApi, getAuthErrorMessage, newPasswordSchema } from '@/api/auth';
import { useAuthSession } from '@/hooks/useAuthSession';
import { isSupabaseConfigured } from '@/utils/supabase';
import './Login.css';

const { Text } = Typography;
type AuthMode = 'signIn' | 'signUp' | 'reset' | 'recovery';

interface LoginFormValues {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const MODE_COPY: Record<AuthMode, { title: string; action: string; intro: string }> = {
  signIn: {
    title: '登录个人围场',
    action: '安全登录',
    intro: '管理账号会话。公开赛事数据无需登录即可浏览。',
  },
  signUp: {
    title: '创建账号',
    action: '创建账号',
    intro: '使用邮箱创建账号；我们会发送验证邮件。',
  },
  reset: {
    title: '重置密码',
    action: '发送重置邮件',
    intro: '输入注册邮箱，我们会发送安全的密码重置链接。',
  },
  recovery: {
    title: '设置新密码',
    action: '保存新密码',
    intro: '重置链接已验证，请为账号设置一个新的安全密码。',
  },
};

const Login = () => {
  const navigate = useNavigate();
  const { session, loading: sessionLoading, passwordRecovery } = useAuthSession();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form] = Form.useForm<LoginFormValues>();
  const activeMode: AuthMode = passwordRecovery ? 'recovery' : mode;
  const copy = MODE_COPY[activeMode];

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFeedback(null);
    form.setFieldValue('password', undefined);
  };

  const handleSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (activeMode === 'signIn') {
        await authApi.signIn(values.email || '', values.password || '');
        setFeedback({ type: 'success', message: '登录成功，正在返回数据中心。' });
        navigate('/', { replace: true });
      } else if (activeMode === 'signUp') {
        await authApi.signUp(values.email || '', values.password || '');
        setFeedback({
          type: 'success',
          message: '如果该邮箱可以注册，你将收到一封验证邮件。请检查收件箱。',
        });
      } else if (activeMode === 'reset') {
        await authApi.requestPasswordReset(values.email || '');
        setFeedback({
          type: 'success',
          message: '如果该邮箱已注册，你将收到一封密码重置邮件。',
        });
      } else {
        await authApi.updatePassword(values.password || '');
        await authApi.signOut();
        setMode('signIn');
        form.resetFields();
        setFeedback({ type: 'success', message: '密码已更新，请使用新密码登录。' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: getAuthErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await authApi.signOut();
      setFeedback({ type: 'success', message: '已安全退出当前账号。' });
    } catch (error) {
      setFeedback({ type: 'error', message: getAuthErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-brand-panel" aria-label="F1 Data Centre">
        <span className="login-brand-index">ACCESS / 01</span>
        <div>
          <strong>F1</strong>
          <h1>YOUR RACE<br />INTELLIGENCE</h1>
          <p>通过安全身份会话管理账号，同时保持公开赛事数据随时可浏览。</p>
        </div>
        <div className="login-brand-features">
          <span><i />公开赛季数据</span>
          <span><i />安全身份会话</span>
          <span><i />密码恢复保护</span>
        </div>
      </section>

      <Card className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">{session && !passwordRecovery ? <UserOutlined /> : 'F1'}</span>
          </div>
          <Typography.Title level={3} className="login-title">
            {session && !passwordRecovery ? '账号已连接' : copy.title}
          </Typography.Title>
          <p className="login-intro">
            {session && !passwordRecovery ? session.user.email : copy.intro}
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <Alert
            type="warning"
            showIcon
            message="身份服务尚未配置"
            description="公开数据仍可浏览；管理员需要配置 Supabase 浏览器环境变量后才能启用账号功能。"
          />
        ) : null}

        {feedback ? (
          <Alert
            className="login-feedback"
            type={feedback.type}
            showIcon
            message={feedback.message}
          />
        ) : null}

        {session && !passwordRecovery ? (
          <div className="login-session-actions">
            <Button type="primary" block onClick={() => navigate('/')}>
              返回数据中心
            </Button>
            <Button block danger loading={submitting} onClick={() => void handleSignOut()}>
              安全退出
            </Button>
          </div>
        ) : (
          <Form
            form={form}
            name="account-access"
            onFinish={(values) => void handleSubmit(values)}
            layout="vertical"
            size="large"
            className="login-form"
            requiredMark={false}
            disabled={!isSupabaseConfigured || sessionLoading}
          >
            {activeMode !== 'recovery' ? (
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱地址' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                  { max: 254, message: '邮箱地址过长' },
                ]}
              >
                <Input
                  type="email"
                  prefix={<MailOutlined />}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </Form.Item>
            ) : null}

            {activeMode !== 'reset' ? (
              <Form.Item
                name="password"
                label={activeMode === 'recovery' ? '新密码' : '密码'}
                rules={[
                  { required: true, message: '请输入密码' },
                  ...(activeMode === 'signUp' || activeMode === 'recovery'
                    ? [{
                      validator: async (_rule: unknown, value: string) => {
                        const result = newPasswordSchema.safeParse(value);
                        if (!result.success) {
                          throw new Error('密码至少 8 位，并同时包含字母和数字');
                        }
                      },
                    }]
                    : []),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={activeMode === 'signIn' ? '输入密码' : '至少 8 位，包含字母和数字'}
                  autoComplete={activeMode === 'signIn' ? 'current-password' : 'new-password'}
                />
              </Form.Item>
            ) : null}

            {activeMode === 'recovery' ? (
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator: async (_rule, value) => {
                      if (!value || getFieldValue('password') === value) return;
                      throw new Error('两次输入的密码不一致');
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="再次输入新密码"
                  autoComplete="new-password"
                />
              </Form.Item>
            ) : null}

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                className="login-button"
                loading={submitting}
              >
                {copy.action}
              </Button>
            </Form.Item>
          </Form>
        )}

        {!session && !passwordRecovery ? (
          <div className="login-footer">
            {mode === 'signIn' ? (
              <Button type="link" onClick={() => changeMode('reset')}>
                忘记密码？
              </Button>
            ) : (
              <Button type="link" onClick={() => changeMode('signIn')}>
                返回登录
              </Button>
            )}
            <div className="login-signup">
              <Text>{mode === 'signUp' ? '已经有账号？' : '还没有账号？'}</Text>
              <Button
                type="link"
                className="login-signup-link"
                onClick={() => changeMode(mode === 'signUp' ? 'signIn' : 'signUp')}
              >
                {mode === 'signUp' ? '登录' : '注册'}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="login-privacy-link">
          <Button type="link" onClick={() => navigate('/privacy')}>
            隐私说明
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Login;
