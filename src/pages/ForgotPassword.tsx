import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { authApi, getAuthErrorMessage } from '@/api/auth';
import { AuthCard } from '@/components/auth/AuthCard';
import { isSupabaseConfigured } from '@/utils/supabase';

interface ResetRequestValues { email: string }

const ForgotPassword = () => {
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async ({ email }: ResetRequestValues) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await authApi.requestPasswordReset(email);
      setFeedback({ type: 'success', message: '如果该邮箱已注册，你将收到一封密码重置邮件。' });
    } catch (error) {
      setFeedback({ type: 'error', message: getAuthErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      eyebrow="ACCOUNT RECOVERY"
      title="重置密码"
      intro="输入注册邮箱，我们会发送密码重置链接。"
      footer={<span>想起密码了？<Link state={location.state} to="/login">返回登录</Link></span>}
    >
      {!isSupabaseConfigured ? <Alert className="auth-card__alert" type="warning" showIcon message="身份服务尚未配置" /> : null}
      {feedback ? <Alert className="auth-card__alert" type={feedback.type} showIcon message={feedback.message} /> : null}
      <Form<ResetRequestValues>
        name="password-reset-request"
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
        <Form.Item noStyle>
          <Button className="auth-card__primary" type="primary" htmlType="submit" block loading={submitting}>发送重置邮件</Button>
        </Form.Item>
      </Form>
    </AuthCard>
  );
};

export default ForgotPassword;
