import { AuthCard } from './AuthCard';
import AuthFrame from './AuthFrame';

export default function AuthSessionPending() {
  return (
    <AuthFrame>
      <div className="auth-session-pending" role="status" aria-live="polite">
        <AuthCard
          title="正在确认登录状态"
          intro="正在连接你的账号，完成后将自动进入数据中心。"
        >
          <div className="auth-session-pending__progress" aria-hidden="true"><span /></div>
          <p className="auth-session-pending__hint">请保持当前页面</p>
        </AuthCard>
      </div>
    </AuthFrame>
  );
}
