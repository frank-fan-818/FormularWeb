import { Button, Result } from 'antd';
import DocumentHead from '@/components/DocumentHead';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <>
      <DocumentHead title="页面未找到 — F1 数据中心" description="请求的 F1 数据页面不存在" robots="noindex" />
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
