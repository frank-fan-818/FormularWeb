import type { ReactNode } from 'react';
import { useAuthEntryPaint } from '@/hooks/useAuthEntryPaint';

interface AuthCardProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const AuthCard = ({ eyebrow, title, intro, children, footer }: AuthCardProps) => {
  useAuthEntryPaint();
  return (
  <div className="auth-card">
    <div className="auth-card__body">
      <header className="auth-card__header">
        <span className="auth-card__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{intro}</p>
      </header>
      {children}
      {footer ? <footer className="auth-card__footer">{footer}</footer> : null}
    </div>
  </div>
  );
};

export function AuthNotice({ type, message, description, action }: {
  type: 'warning' | 'success' | 'error';
  message: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`auth-card__alert auth-notice auth-notice--${type}`} role={type === 'success' ? 'status' : 'alert'}>
      <strong>{message}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
