import type { ReactNode } from 'react';
import { Card } from 'antd';

interface AuthCardProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const AuthCard = ({ eyebrow, title, intro, children, footer }: AuthCardProps) => (
  <Card className="auth-card" bordered={false}>
    <header className="auth-card__header">
      <span className="auth-card__eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{intro}</p>
    </header>
    {children}
    {footer ? <footer className="auth-card__footer">{footer}</footer> : null}
  </Card>
);
