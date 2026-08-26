import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { authApi, getAuthErrorMessage, newPasswordSchema } from '@/api/auth';
import { AuthCard } from '@/components/auth/AuthCard';
import { isSupabaseConfigured } from '@/utils/supabase';

interface RegisterFormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

const passwordRule = {
  validator: async (_rule: unknown, value: string) => {
    if (!newPasswordSchema.safeParse(value).success) {
      throw new Error('密码至少 8 位，并同时包含字母和数字');
    }
  },
};

const Register = () => {
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (values: RegisterFormValues) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await authApi.signUp(values.email, values.password);
      setFeedback({ type: 'success', message: '账号申请已提交。请打开验证邮件完成注册，然后返回登录。' });
    } catch (error) {
      setFeedback({ type: 'error', message: getAuthErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      eyebrow="CREATE ACCOUNT"
      title="创建账号"
      intro="使用邮箱注册。完成验证后即可登录。"
      footer={<span>已经有账号？<Link state={location.state} to="/login">返回登录</Link></span>}
    >
      {!isSupabaseConfigured ? <Alert className="auth-card__alert" type="warning" showIcon message="身份服务尚未配置" /> : null}
      {feedback ? <Alert className="auth-card__alert" type={feedback.type} showIcon message={feedback.message} /> : null}
      <Form<RegisterFormValues>
        name="email-register"
        layout="vertical"
        size="large"
        requiredMark={false}
        disabled={!isSupabaseConfigured}
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
        <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, passwordRule]}>
          <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位，包含字母和数字" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认密码"
          dependencies={['password']}
          rules={[
            { required: true, message: '请再次输入密码' },
            ({ getFieldValue }) => ({
              validator: async (_rule, value) => {
                if (!value || getFieldValue('password') === value) return;
                throw new Error('两次输入的密码不一致');
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="再次输入密码" autoComplete="new-password" />
        </Form.Item>
        <Form.Item noStyle>
          <Button className="auth-card__primary" type="primary" htmlType="submit" block loading={submitting}>创建账号</Button>
        </Form.Item>
      </Form>
    </AuthCard>
  );
};

export default Register;
