import React from 'react';
import ProductsDashboard from '@/components/ProductsDashboard';

interface Shop {
  id: string;
  shop_domain: string;
  shop_name: string;
  email: string;
  installed_at: string;
}

interface ProductsProps {
  shop: Shop;
}

const Products: React.FC<ProductsProps> = ({ shop }) => {
  return <ProductsDashboard shop={shop} />;
};

export default Products;
