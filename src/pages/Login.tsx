import { useTranslation } from 'react-i18next';
import { Card, Form, Input, Button, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import './Login.css';

const { Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const Login = () => {
  const { t } = useTranslation();

  const handleSubmit = (values: LoginFormValues) => {
    console.log('Login form submitted:', values);
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">F1</span>
          </div>
          <Typography.Title level={3} className="login-title">
            {t('loginTitle')}
          </Typography.Title>
        </div>

        <Form
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          className="login-form"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            rules={[
              {
                required: true,
                message: t('loginEmailRequired'),
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder={t('loginEmailPlaceholder')}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              {
                required: true,
                message: t('loginPasswordRequired'),
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('loginPasswordPlaceholder')}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              className="login-button"
            >
              {t('loginButton')}
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <span className="login-forgot-password">
            {t('loginForgotPassword')}
          </span>
          <div className="login-signup">
            <Text>{t('loginNoAccount')}</Text>
            <Button type="link" className="login-signup-link">
              {t('loginSignUp')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
