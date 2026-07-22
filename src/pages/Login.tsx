import { useTranslation } from 'react-i18next';
import { Card, Form, Input, Button, Typography, message } from 'antd';
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
    void values;
    void message.info('\u767b\u5f55\u670d\u52a1\u5c1a\u672a\u5f00\u653e\uff0c\u5f53\u524d\u53ef\u7ee7\u7eed\u6d4f\u89c8\u516c\u5f00\u6570\u636e\u3002');
  };

  return (
    <div className="login-page">
      <section className="login-brand-panel" aria-label="F1 Data Centre">
        <span className="login-brand-index">ACCESS / 01</span>
        <div>
          <strong>F1</strong>
          <h1>YOUR RACE<br />INTELLIGENCE</h1>
          <p>保存关注对象、同步比较视图，并为未来的专业数据订阅建立一个稳定入口。</p>
        </div>
        <div className="login-brand-features">
          <span><i />公开赛季数据</span>
          <span><i />个人关注列表</span>
          <span><i />专业分析扩展</span>
        </div>
      </section>
      <Card className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">F1</span>
          </div>
          <Typography.Title level={3} className="login-title">
            {t('loginTitle')}
          </Typography.Title>
          <p className="login-intro">进入你的个人围场。未登录用户仍可继续浏览基础数据。</p>
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
