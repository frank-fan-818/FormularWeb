import { Button, Result } from 'antd';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>页面未找到 — F1 数据中心</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Result
        status="404"
        title="赛道之外"
        subTitle="这个页面不存在，或链接已经失效。"
        extra={(
          <Button type="primary" onClick={() => navigate('/', { replace: true })}>
            返回数据中心
          </Button>
        )}
      />
    </>
  );
};

export default NotFound;
