import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getAccessDecision } from '@/utils/accessPolicy';
import './AccessGate.css';

export function MemberAccess({ children, feature = '深度赛事分析' }: { children: ReactNode; feature?: string }) {
  const { session, loading } = useAuthSession();
  const location = useLocation();
  const decision = getAccessDecision(loading, Boolean(session), true, true);
  if (decision === 'loading') return <div role="status" className="member-access">正在确认账号权限…</div>;
  if (decision === 'allow') return <>{children}</>;
  return (
    <section className="member-access" aria-label={`${feature}需要登录`}>
      <span className="member-access__eyebrow">USER ACCESS</span>
      <h2>登录后查看{feature}</h2>
      <p>游客可浏览赛历、比赛结果和积分榜。创建免费账号，解锁圈速、遥测、策略分析与预测。</p>
      <Link className="member-access__action" to="/login" state={{ from: `${location.pathname}${location.search}${location.hash}` }}>登录 / 创建账号</Link>
    </section>
  );
}

export function SiteAccess() {
  const { session, loading, guest } = useAuthSession();
  const location = useLocation();
  const decision = getAccessDecision(loading, Boolean(session), guest);
  if (decision === 'loading') return <div className="member-access" role="status">正在确认登录状态…</div>;
  if (decision === 'login') return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  return <Outlet />;
}
