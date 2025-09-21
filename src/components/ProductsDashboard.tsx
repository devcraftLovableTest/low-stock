import React, { useEffect, useState } from 'react';
import { 
  Page, 
  Card, 
  DataTable, 
  Button, 
  TextField, 
  Select, 
  Layout,
  Banner,
  Spinner,
  Toast,
  Frame
} from '@shopify/polaris';
import { supabase } from "@/integrations/supabase/client";

interface ProductItem {
  id: string;
  title: string;
  sku: string | null;
  inventory_quantity: number | null;
  price: number | null;
  compare_at_price: number | null;
  status: string | null;
  shopify_product_id: number | null;
  shopify_variant_id: number | null;
}

interface Shop {
  id: string;
  shop_domain: string;
  shop_name: string;
}

interface ProductsDashboardProps {
  shop: Shop;
}

const ProductsDashboard: React.FC<ProductsDashboardProps> = ({ shop }) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPricing, setBulkPricing] = useState({ price: '', comparePrice: '', actionName: '' });
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [shop.shop_domain]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get-inventory',
          shopDomain: shop.shop_domain,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.inventory || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncWithShopify = async () => {
    setSyncing(true);
    try {
      // Get shop access token
      const { data: shopData } = await supabase
        .from('shops')
        .select('access_token')
        .eq('shop_domain', shop.shop_domain)
        .single();

      if (shopData) {
        const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'fetch-products',
            shopDomain: shop.shop_domain,
            accessToken: shopData.access_token,
          }),
        });

        if (response.ok) {
          await fetchProducts();
          setToastMessage('Products synced successfully!');
          setShowToast(true);
        }
      }
    } catch (error) {
      console.error('Error syncing with Shopify:', error);
      setToastMessage('Error syncing products');
      setShowToast(true);
    } finally {
      setSyncing(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAllProducts = () => {
    setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
  };

  const deselectAllProducts = () => {
    setSelectedProducts(new Set());
  };

  const applyBulkPricing = async () => {
    if (selectedProducts.size === 0 || !bulkPricing.actionName.trim()) {
      setToastMessage('Please select products and provide an action name');
      setShowToast(true);
      return;
    }

    try {
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk-update-prices',
          shopDomain: shop.shop_domain,
          productIds: Array.from(selectedProducts),
          price: bulkPricing.price,
          compareAtPrice: bulkPricing.comparePrice,
          actionName: bulkPricing.actionName,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state
        setProducts(prev => prev.map(product => {
          if (selectedProducts.has(product.id)) {
            return {
              ...product, 
              price: bulkPricing.price ? parseFloat(bulkPricing.price) : product.price,
              compare_at_price: bulkPricing.comparePrice ? parseFloat(bulkPricing.comparePrice) : product.compare_at_price
            };
          }
          return product;
        }));
        
        // Reset bulk state
        setSelectedProducts(new Set());
        setBulkPricing({ price: '', comparePrice: '', actionName: '' });
        setBulkMode(false);

        setToastMessage(`Bulk action "${bulkPricing.actionName}" applied to ${selectedProducts.size} products`);
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error applying bulk pricing:', error);
      setToastMessage('Error applying bulk pricing');
      setShowToast(true);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const rows = filteredProducts.map((product) => {
    const isSelected = selectedProducts.has(product.id);

    return [
      bulkMode ? (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleProductSelection(product.id)}
          style={{ transform: 'scale(1.2)' }}
        />
      ) : (
        product.title
      ),
      bulkMode ? product.title : (product.sku || '-'),
      bulkMode ? (product.sku || '-') : (product.price ? `$${product.price.toFixed(2)}` : '-'),
      bulkMode ? (product.price ? `$${product.price.toFixed(2)}` : '-') : (product.compare_at_price ? `$${product.compare_at_price.toFixed(2)}` : '-'),
      bulkMode ? (product.compare_at_price ? `$${product.compare_at_price.toFixed(2)}` : '-') : (product.inventory_quantity || 0),
      bulkMode ? (product.inventory_quantity || 0) : null
    ].filter(item => item !== null);
  });

  if (loading) {
    return (
      <Page title="Products">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px' 
              }}>
                <Spinner accessibilityLabel="Loading products" size="large" />
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const toast = showToast ? (
    <Toast
      content={toastMessage}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  return (
    <Frame>
      <Page 
        title="Products & Pricing"
        primaryAction={{
          content: syncing ? 'Syncing...' : 'Sync with Shopify',
          loading: syncing,
          onAction: syncWithShopify,
        }}
        secondaryActions={[
          {
            content: bulkMode ? 'Exit Bulk Mode' : 'Bulk Pricing',
            onAction: () => {
              setBulkMode(!bulkMode);
              setSelectedProducts(new Set());
              setBulkPricing({ price: '', comparePrice: '', actionName: '' });
            },
          },
          {
            content: 'Bulk Actions History',
            onAction: () => window.location.href = '/bulk-actions',
          }
        ]}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Shop Information
                </h2>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600', marginBottom: '4px' }}>Shop Name:</p>
                    <p style={{ color: '#6B7280' }}>{shop.shop_name || shop.shop_domain}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: '600', marginBottom: '4px' }}>Domain:</p>
                    <p style={{ color: '#6B7280' }}>{shop.shop_domain}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: '600', marginBottom: '4px' }}>Products:</p>
                    <p style={{ color: '#6B7280' }}>{products.length} items</p>
                  </div>
                </div>
              </div>
            </Card>
          </Layout.Section>

          <Layout.Section>
            {products.length === 0 && (
              <Banner tone="info">
                <p>No products found. Click "Sync with Shopify" to import your products.</p>
              </Banner>
            )}
            
            <Card>
              <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    labelHidden
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search products..."
                    clearButton
                    onClearButtonClick={() => setSearchQuery('')}
                    autoComplete="off"
                  />
                </div>
                <div style={{ width: '200px' }}>
                  <Select
                    label=""
                    labelHidden
                    options={[
                      { label: 'All products', value: 'all' },
                      { label: 'In stock', value: 'in_stock' },
                      { label: 'Low stock', value: 'low_stock' },
                      { label: 'Out of stock', value: 'out_of_stock' },
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                </div>
              </div>

              {bulkMode && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '16px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '1px solid #e1e5e9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                    <Button size="slim" onClick={selectAllProducts}>Select All</Button>
                    <Button size="slim" onClick={deselectAllProducts}>Deselect All</Button>
                    <span style={{ fontWeight: 'bold', color: '#6B7280' }}>
                      {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'end' }}>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Action Name"
                        value={bulkPricing.actionName}
                        onChange={(value) => setBulkPricing(prev => ({ ...prev, actionName: value }))}
                        placeholder="e.g., Holiday Sale 2024"
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ width: '150px' }}>
                      <TextField
                        label="New Price"
                        value={bulkPricing.price}
                        onChange={(value) => setBulkPricing(prev => ({ ...prev, price: value }))}
                        prefix="$"
                        type="number"
                        placeholder="Optional"
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ width: '150px' }}>
                      <TextField
                        label="Compare At Price"
                        value={bulkPricing.comparePrice}
                        onChange={(value) => setBulkPricing(prev => ({ ...prev, comparePrice: value }))}
                        prefix="$"
                        type="number"
                        placeholder="Optional"
                        autoComplete="off"
                      />
                    </div>
                    <Button 
                      variant="primary" 
                      onClick={applyBulkPricing}
                      disabled={selectedProducts.size === 0 || !bulkPricing.actionName.trim()}
                    >
                      Apply Bulk Changes
                    </Button>
                  </div>
                </div>
              )}

              <DataTable
                columnContentTypes={bulkMode 
                  ? ['text', 'text', 'text', 'text', 'text', 'numeric'] 
                  : ['text', 'text', 'text', 'text', 'numeric']
                }
                headings={bulkMode 
                  ? ['Select', 'Product', 'SKU', 'Price', 'Compare At Price', 'Stock'] 
                  : ['Product', 'SKU', 'Price', 'Compare At Price', 'Stock']
                }
                rows={rows}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      {toast}
    </Frame>
  );
};

export default ProductsDashboard;