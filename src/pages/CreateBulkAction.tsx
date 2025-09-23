import React, { useEffect, useState } from 'react';
import { 
  Page, 
  Card, 
  Button, 
  TextField, 
  Select,
  Layout,
  Banner,
  Spinner,
  Toast,
  Frame,
  Checkbox,
  DataTable,
  ButtonGroup
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

interface Collection {
  id: string;
  title: string;
  handle: string;
  products_count: number;
}

interface Shop {
  id: string;
  shop_domain: string;
  shop_name: string;
}

interface CreateBulkActionProps {
  shop: Shop;
}

const CreateBulkAction: React.FC<CreateBulkActionProps> = ({ shop }) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [bulkPricing, setBulkPricing] = useState({ 
    price: '', 
    comparePrice: '', 
    actionName: '' 
  });
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCollections()]);
  }, [shop.shop_domain]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('shop_domain', shop.shop_domain)
        .order('title');

      if (error) {
        console.error('Error fetching products:', error);
        setToastMessage('Error loading products');
        setShowToast(true);
      } else {
        setProducts(data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fetch-collections',
          shopDomain: shop.shop_domain,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const handleCollectionToggle = async (collectionId: string) => {
    const newSelectedCollections = new Set(selectedCollections);
    
    if (newSelectedCollections.has(collectionId)) {
      newSelectedCollections.delete(collectionId);
      // Remove products from this collection
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fetch-collection-products',
          shopDomain: shop.shop_domain,
          collectionId: collectionId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const collectionProductIds = new Set(data.products?.map((p: any) => p.id) || []);
        const newSelectedProducts = new Set(selectedProducts);
        collectionProductIds.forEach(id => newSelectedProducts.delete(id as string));
        setSelectedProducts(newSelectedProducts);
      }
    } else {
      newSelectedCollections.add(collectionId);
      // Add products from this collection
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fetch-collection-products',
          shopDomain: shop.shop_domain,
          collectionId: collectionId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const collectionProductIds = data.products?.map((p: any) => p.id) || [];
        const newSelectedProducts = new Set(selectedProducts);
        collectionProductIds.forEach((id: string) => newSelectedProducts.add(id));
        setSelectedProducts(newSelectedProducts);
      }
    }
    
    setSelectedCollections(newSelectedCollections);
  };

  const handleProductToggle = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const createBulkAction = async () => {
    if (!bulkPricing.actionName.trim()) {
      setToastMessage('Please enter an action name');
      setShowToast(true);
      return;
    }

    if (selectedProducts.size === 0) {
      setToastMessage('Please select at least one product');
      setShowToast(true);
      return;
    }

    if (!bulkPricing.price && !bulkPricing.comparePrice) {
      setToastMessage('Please enter at least one price');
      setShowToast(true);
      return;
    }

    setCreating(true);

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
          newPrice: bulkPricing.price ? parseFloat(bulkPricing.price) : null,
          newComparePrice: bulkPricing.comparePrice ? parseFloat(bulkPricing.comparePrice) : null,
          actionName: bulkPricing.actionName.trim(),
        }),
      });

      if (response.ok) {
        setToastMessage('Bulk action created successfully!');
        setShowToast(true);
        // Reset form
        setSelectedProducts(new Set());
        setSelectedCollections(new Set());
        setBulkPricing({ price: '', comparePrice: '', actionName: '' });
        // Navigate back to bulk actions list
        setTimeout(() => {
          window.location.href = '/bulk-actions';
        }, 1500);
      } else {
        setToastMessage('Error creating bulk action');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error creating bulk action:', error);
      setToastMessage('Error creating bulk action');
      setShowToast(true);
    } finally {
      setCreating(false);
    }
  };

  const productRows = products.map((product) => [
    <Checkbox
      label=""
      checked={selectedProducts.has(product.id)}
      onChange={() => handleProductToggle(product.id)}
    />,
    product.title,
    product.sku || '-',
    product.price ? `$${product.price.toFixed(2)}` : '-',
    product.compare_at_price ? `$${product.compare_at_price.toFixed(2)}` : '-',
    product.inventory_quantity || 0,
    product.status || 'unknown'
  ]);

  if (loading) {
    return (
      <Page title="Create Bulk Action">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px' 
              }}>
                <Spinner accessibilityLabel="Loading" size="large" />
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
        title="Create Bulk Price Action"
        backAction={{content: 'Back to Bulk Actions', onAction: () => window.location.href = '/bulk-actions'}}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
                  Bulk Price Update
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <TextField
                    label="Action Name"
                    value={bulkPricing.actionName}
                    onChange={(value) => setBulkPricing({...bulkPricing, actionName: value})}
                    placeholder="e.g., Summer Sale 2024"
                    helpText="Give this bulk action a descriptive name"
                    autoComplete="off"
                  />
                  
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="New Price ($)"
                        value={bulkPricing.price}
                        onChange={(value) => setBulkPricing({...bulkPricing, price: value})}
                        type="number"
                        placeholder="0.00"
                        autoComplete="off"
                      />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="New Compare At Price ($)"
                        value={bulkPricing.comparePrice}
                        onChange={(value) => setBulkPricing({...bulkPricing, comparePrice: value})}
                        type="number"
                        placeholder="0.00"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Layout.Section>

          {collections.length > 0 && (
            <Layout.Section>
              <Card>
                <div style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                    Select Collections
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {collections.map((collection) => (
                      <Checkbox
                        key={collection.id}
                        label={`${collection.title} (${collection.products_count} products)`}
                        checked={selectedCollections.has(collection.id)}
                        onChange={() => handleCollectionToggle(collection.id)}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    Select Products ({selectedProducts.size} selected)
                  </h3>
                  <Button onClick={handleSelectAll}>
                    {selectedProducts.size === products.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
              
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'numeric', 'text']}
                headings={['Select', 'Product', 'SKU', 'Price', 'Compare At', 'Inventory', 'Status']}
                rows={productRows}
              />
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <ButtonGroup>
                    <Button onClick={() => window.location.href = '/bulk-actions'}>
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      loading={creating}
                      onClick={createBulkAction}
                      disabled={selectedProducts.size === 0 || !bulkPricing.actionName.trim()}
                    >
                      Create Bulk Action
                    </Button>
                  </ButtonGroup>
                </div>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      {toast}
    </Frame>
  );
};

export default CreateBulkAction;