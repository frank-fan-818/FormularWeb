import type { ReactNode } from 'react';
import './ProductPage.css';

interface ProductSectionHeaderProps {
  index?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

const ProductSectionHeader = ({ index, eyebrow, title, description, action }: ProductSectionHeaderProps) => (
  <header className="product-section-header">
    <div className="product-section-header__copy">
      <div className="product-section-header__kicker">
        {index ? <span>{index}</span> : null}
        {eyebrow ? <small>{eyebrow}</small> : null}
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
    {action ? <div className="product-section-header__action">{action}</div> : null}
  </header>
);

export default ProductSectionHeader;
