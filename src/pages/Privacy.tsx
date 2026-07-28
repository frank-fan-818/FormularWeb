import { Card, Typography } from 'antd';
import { Helmet } from 'react-helmet-async';
import './Privacy.css';

const { Paragraph, Text, Title } = Typography;

const Privacy = () => (
  <>
    <Helmet>
      <title>隐私说明 — F1 数据中心</title>
      <meta
        name="description"
        content="F1 数据中心的账号、诊断数据与本地偏好处理说明"
      />
    </Helmet>
    <article className="privacy-page">
      <header>
        <Text className="privacy-kicker">PRIVACY / ACCOUNT</Text>
        <Title level={1}>隐私说明</Title>
        <Paragraph type="secondary">最后更新：2026 年 7 月 28 日</Paragraph>
      </header>

      <Card>
        <Title level={2}>我们处理哪些数据</Title>
        <Paragraph>
          公开赛事数据无需登录。创建账号时，身份服务会处理你的邮箱、密码凭据和登录会话；
          密码本身由 Supabase 身份服务处理，本应用不会读取或记录明文密码。
        </Paragraph>

        <Title level={2}>诊断与本地偏好</Title>
        <Paragraph>
          登录用户遇到应用错误时，我们可能记录错误摘要、浏览器类型和不含查询参数或片段的页面路径，
          用于排查故障。主题、语言和部分界面偏好保存在当前设备。
        </Paragraph>

        <Title level={2}>第三方服务</Title>
        <Paragraph>
          账号与诊断数据使用 Supabase；公开 F1 数据可能来自 Jolpica/Ergast 兼容接口。
          这些服务会依据各自政策处理网络请求中的必要技术信息。
        </Paragraph>

        <Title level={2}>控制与联系</Title>
        <Paragraph>
          你可以随时退出登录并清除站点数据。如需查询或删除账号数据，请通过
          {' '}
          <a
            href="https://github.com/frank-fan-818/FormularWeb/issues"
            target="_blank"
            rel="noreferrer"
          >
            项目问题追踪器
          </a>
          {' '}
          联系维护者，请勿在公开问题中提交密码、令牌或其他敏感信息。
        </Paragraph>
      </Card>
    </article>
  </>
);

export default Privacy;
