import type { CSSProperties, ReactNode } from 'react';
import './ProductPage.css';

export interface ProductMetric {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: string;
}

interface ProductMastheadProps {
  index?: string;
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metrics?: ProductMetric[];
  actions?: ReactNode;
  aside?: ReactNode;
  tone?: 'command' | 'index' | 'archive' | 'utility';
  className?: string;
  accent?: string;
}

const ProductMasthead = ({
  index,
  eyebrow,
  title,
  description,
  metrics = [],
  actions,
  aside,
  tone = 'command',
  className = '',
  accent,
}: ProductMastheadProps) => {
  const style = accent ? ({ '--product-accent': accent } as CSSProperties) : undefined;

  return (
    <header className={`product-masthead product-masthead--${tone} ${className}`.trim()} style={style}>
      <div className="product-masthead__grid-mark" aria-hidden="true" />
      <div className="product-masthead__main">
        <div className="product-masthead__eyebrow">
          {index ? <span className="product-masthead__index">{index}</span> : null}
          <span>{eyebrow}</span>
        </div>
        <h1 className="product-masthead__title">{title}</h1>
        {description ? <p className="product-masthead__description">{description}</p> : null}
        {actions ? <div className="product-masthead__actions">{actions}</div> : null}
      </div>

      {aside ? <div className="product-masthead__aside">{aside}</div> : null}

      {metrics.length > 0 ? (
        <div className="product-metric-rail" aria-label="关键数据">
          {metrics.map((metric) => (
            <div
              className="product-metric"
              key={metric.label}
              style={metric.accent ? ({ '--metric-accent': metric.accent } as CSSProperties) : undefined}
            >
              <span className="product-metric__label">{metric.label}</span>
              <strong className="product-metric__value">{metric.value}</strong>
              {metric.detail ? <span className="product-metric__detail">{metric.detail}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
};

export default ProductMasthead;
