import type { ReactNode } from 'react';
import './ProductPage.css';

interface ProductSectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

const ProductSectionHeader = ({ title, description, action }: ProductSectionHeaderProps) => (
  <header className="product-section-header">
    <div className="product-section-header__copy">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
    {action ? <div className="product-section-header__action">{action}</div> : null}
  </header>
);

export default ProductSectionHeader;
