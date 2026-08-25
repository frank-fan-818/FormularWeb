import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authApi, getAuthErrorMessage, newPasswordSchema } from '@/api/auth';
import { AuthCard } from '@/components/auth/AuthCard';
import { useAuthSession } from '@/hooks/useAuthSession';
import { TimingBeacon } from '@/components/loading/TimingBeacon';

interface ResetPasswordValues {
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const { loading, passwordRecovery } = useAuthSession();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async ({ password }: ResetPasswordValues) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await authApi.updatePassword(password);
      await authApi.signOut();
      navigate('/login?reset=1', { replace: true });
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      eyebrow="SECURE RECOVERY"
      title="设置新密码"
      intro="重置链接验证成功后，为账号设置一个新的安全密码。"
      footer={<span><Link to="/login">返回登录</Link></span>}
    >
      {loading ? (
        <div className="auth-card__loading">
          <TimingBeacon variant="inline" label="Verifying recovery link" detail="Checking session security" />
        </div>
      ) : !passwordRecovery ? (
        <Alert
          className="auth-card__alert"
          type="warning"
          showIcon
          message="重置链接无效或已过期"
          description="请重新申请密码重置邮件，并使用邮件中的最新链接。"
        />
      ) : (
        <>
          {errorMessage ? <Alert className="auth-card__alert" type="error" showIcon message={errorMessage} /> : null}
          <Form<ResetPasswordValues>
            name="password-reset"
            layout="vertical"
            size="large"
            requiredMark={false}
            onFinish={(values) => void handleSubmit(values)}
          >
            <Form.Item
              name="password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                {
                  validator: async (_rule, value) => {
                    if (!newPasswordSchema.safeParse(value).success) {
                      throw new Error('密码至少 8 位，并同时包含字母和数字');
                    }
                  },
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位，包含字母和数字" autoComplete="new-password" />
            </Form.Item>
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
              <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" autoComplete="new-password" />
            </Form.Item>
            <Form.Item noStyle>
              <Button className="auth-card__primary" type="primary" htmlType="submit" block loading={submitting}>保存新密码</Button>
            </Form.Item>
          </Form>
        </>
      )}
    </AuthCard>
  );
};

export default ResetPassword;
