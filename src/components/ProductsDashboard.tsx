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
  const [editingPrices, setEditingPrices] = useState<{[key: string]: {price: string, comparePrice: string}}>({});
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

  const handlePriceEdit = (itemId: string, field: 'price' | 'comparePrice', value: string) => {
    setEditingPrices(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const savePriceChanges = async (itemId: string) => {
    const edits = editingPrices[itemId];
    if (!edits) return;

    try {
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-prices',
          shopDomain: shop.shop_domain,
          itemId,
          price: edits.price,
          compareAtPrice: edits.comparePrice,
        }),
      });

      if (response.ok) {
        // Update local state
        setProducts(prev => prev.map(product => 
          product.id === itemId 
            ? { 
                ...product, 
                price: edits.price ? parseFloat(edits.price) : null,
                compare_at_price: edits.comparePrice ? parseFloat(edits.comparePrice) : null
              }
            : product
        ));
        
        // Clear editing state
        setEditingPrices(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });

        setToastMessage('Prices updated successfully!');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error updating prices:', error);
      setToastMessage('Error updating prices');
      setShowToast(true);
    }
  };

  const cancelPriceEdit = (itemId: string) => {
    setEditingPrices(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const rows = filteredProducts.map((product) => {
    const editing = editingPrices[product.id];
    const isEditing = !!editing;

    return [
      product.title,
      product.sku || '-',
      isEditing ? (
        <TextField
          label=""
          labelHidden
          value={editing.price || product.price?.toString() || ''}
          onChange={(value) => handlePriceEdit(product.id, 'price', value)}
          prefix="$"
          type="number"
          autoComplete="off"
        />
      ) : (
        product.price ? `$${product.price.toFixed(2)}` : '-'
      ),
      isEditing ? (
        <TextField
          label=""
          labelHidden
          value={editing.comparePrice || product.compare_at_price?.toString() || ''}
          onChange={(value) => handlePriceEdit(product.id, 'comparePrice', value)}
          prefix="$"
          type="number"
          autoComplete="off"
        />
      ) : (
        product.compare_at_price ? `$${product.compare_at_price.toFixed(2)}` : '-'
      ),
      product.inventory_quantity || 0,
      isEditing ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            size="slim" 
            variant="primary" 
            onClick={() => savePriceChanges(product.id)}
          >
            Save
          </Button>
          <Button 
            size="slim" 
            onClick={() => cancelPriceEdit(product.id)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button 
          size="slim" 
          onClick={() => handlePriceEdit(product.id, 'price', product.price?.toString() || '')}
        >
          Edit Prices
        </Button>
      )
    ];
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
      >
        <Layout>
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

              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text']}
                headings={['Product', 'SKU', 'Price', 'Compare At Price', 'Stock', 'Actions']}
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