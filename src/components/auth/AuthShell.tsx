import { Link, Outlet } from 'react-router-dom';
import './AuthShell.css';

const accessSignals = [
  ['HISTORY', 'Seasons & results'],
  ['PERFORMANCE', 'Lap & sector pace'],
  ['TELEMETRY', 'Speed · throttle · gear'],
];

const AuthShell = () => (
  <div className="auth-center">
    <section className="auth-center__brand" aria-label="F1 Race Intelligence">
      <div className="auth-center__grid" aria-hidden="true" />
      <div className="auth-center__track" aria-hidden="true"><span /><span /><span /></div>
      <header className="auth-center__brand-header">
        <Link className="auth-center__mark" to="/" aria-label="返回 F1 数据中心">
          <span>F1</span><strong>RACE INTELLIGENCE</strong>
        </Link>
        <span className="auth-center__system-status"><i /> SYSTEM ONLINE</span>
      </header>
      <div className="auth-center__brand-copy">
        <span className="auth-center__eyebrow">RACE INTELLIGENCE / DATA CENTRE</span>
        <h1>The race,<br />in full context.</h1>
        <p>Explore seasons, results and championship standings—then go deeper with lap pace, tyre strategy and telemetry.</p>
      </div>
      <div className="auth-center__signals" aria-label="产品能力">
        {accessSignals.map(([value, label]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </div>
    </section>

    <section className="auth-center__stage">
      <div className="auth-center__mobile-brand">
        <Link to="/" aria-label="返回 F1 数据中心"><span>F1</span> RACE INTELLIGENCE</Link>
        <span>SECURE ACCESS</span>
      </div>
      <main className="auth-center__panel"><Outlet /></main>
      <footer className="auth-center__footer">
        <span>公开赛事数据无需登录即可浏览</span>
        <Link to="/privacy">隐私说明</Link>
        <Link to="/">返回数据中心</Link>
      </footer>
    </section>
  </div>
);

export default AuthShell;
