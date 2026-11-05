import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SiteCredit from '@/components/SiteCredit';
import './AuthShell.css';

const AuthFrame = ({ children }: { children: ReactNode }) => (
  <div className="auth-center">
    <section className="auth-center__brand" aria-label="F1 Race Intelligence">
      <div className="auth-center__grid" aria-hidden="true" />
      <div className="auth-center__track" aria-hidden="true"><span /><span /><span /></div>
      <header className="auth-center__brand-header">
        <Link className="auth-center__mark" to="/" aria-label="F1 Race Intelligence — 返回数据中心">
          <span>F1</span><strong>RACE INTELLIGENCE</strong>
        </Link>
      </header>
      <div className="auth-center__brand-copy">
        <h1>The race,<br />in full context.</h1>
      </div>
    </section>

    <section className="auth-center__stage">
      <div className="auth-center__mobile-brand">
        <Link to="/" aria-label="F1 Race Intelligence — 返回数据中心"><span>F1</span> RACE INTELLIGENCE</Link>
        <span>SECURE ACCESS</span>
      </div>
      <main className="auth-center__panel">{children}</main>
      <footer className="auth-center__footer">
        <span>游客浏览基础数据 · 登录解锁深度分析</span>
        <Link to="/privacy">隐私说明</Link>
        <Link to="/">选择访问方式</Link>
        <SiteCredit />
      </footer>
    </section>
  </div>
);

export default AuthFrame;
