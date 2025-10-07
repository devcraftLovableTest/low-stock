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
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'collection' | 'vendor'>('all');
  const [bulkPricing, setBulkPricing] = useState({ 
    price: '', 
    comparePrice: '', 
    actionName: '',
    adjustmentType: 'fixed', // 'fixed' or 'percentage'
    adjustmentDirection: 'increase', // 'increase' or 'decrease'
    adjustmentValue: '',
    adjustmentTarget: 'price' // 'price' or 'compare_price' or 'both'
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
        // Extract unique vendors
        const uniqueVendors = Array.from(new Set(
          (data || [])
            .map(p => p.title.split(' - ')[0]) // Extract vendor from title
            .filter(Boolean)
        )).sort();
        setVendors(uniqueVendors);
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
    const currentFiltered = products.filter(product => {
      if (filterType === 'vendor' && selectedVendor) {
        return product.title.startsWith(selectedVendor);
      }
      return true;
    });
    
    if (selectedProducts.size === currentFiltered.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(currentFiltered.map(p => p.id)));
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

    if (!bulkPricing.adjustmentValue || parseFloat(bulkPricing.adjustmentValue) === 0) {
      setToastMessage('Please enter an adjustment value');
      setShowToast(true);
      return;
    }

    setCreating(true);

    try {
      // Calculate new prices based on adjustment settings
      const selectedProductsData = products.filter(p => selectedProducts.has(p.id));
      const priceUpdates = selectedProductsData.map(product => {
        const adjustmentValue = parseFloat(bulkPricing.adjustmentValue);
        let newPrice = product.price;
        let newComparePrice = product.compare_at_price;

        const calculateNewPrice = (currentPrice: number | null) => {
          if (!currentPrice) return null;
          
          let adjustedPrice = currentPrice;
          if (bulkPricing.adjustmentType === 'percentage') {
            const multiplier = bulkPricing.adjustmentDirection === 'increase' 
              ? (1 + adjustmentValue / 100) 
              : (1 - adjustmentValue / 100);
            adjustedPrice = currentPrice * multiplier;
          } else {
            adjustedPrice = bulkPricing.adjustmentDirection === 'increase'
              ? currentPrice + adjustmentValue
              : currentPrice - adjustmentValue;
          }
          return Math.max(0, adjustedPrice); // Ensure price doesn't go negative
        };

        if (bulkPricing.adjustmentTarget === 'price' || bulkPricing.adjustmentTarget === 'both') {
          newPrice = calculateNewPrice(product.price);
        }
        if (bulkPricing.adjustmentTarget === 'compare_price' || bulkPricing.adjustmentTarget === 'both') {
          newComparePrice = calculateNewPrice(product.compare_at_price);
        }

        return {
          productId: product.id,
          newPrice,
          newComparePrice
        };
      });

      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk-update-prices-calculated',
          shopDomain: shop.shop_domain,
          priceUpdates,
          actionName: bulkPricing.actionName.trim(),
        }),
      });

      if (response.ok) {
        setToastMessage('Bulk action created successfully!');
        setShowToast(true);
        // Reset form
        setSelectedProducts(new Set());
        setSelectedCollections(new Set());
        setBulkPricing({ 
          price: '', 
          comparePrice: '', 
          actionName: '',
          adjustmentType: 'fixed',
          adjustmentDirection: 'increase',
          adjustmentValue: '',
          adjustmentTarget: 'price'
        });
        // Navigate back to bulk actions list
        setTimeout(() => {
          navigate('/bulk-actions');
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

  // Filter products based on selection
  const filteredProducts = products.filter(product => {
    if (filterType === 'vendor' && selectedVendor) {
      return product.title.startsWith(selectedVendor);
    }
    return true;
  });

  const productRows = filteredProducts.map((product) => [
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
        backAction={{content: 'Back to Bulk Actions', onAction: () => navigate('/bulk-actions')}}
      >
        <Layout>
          {/* Step 1: Filter Selection */}
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
                  Step 1: Select Products
                </h2>
                
                <div style={{ marginBottom: '16px' }}>
                  <Select
                    label="Filter By"
                    options={[
                      {label: 'All Products', value: 'all'},
                      {label: 'By Collection', value: 'collection'},
                      {label: 'By Vendor', value: 'vendor'},
                    ]}
                    value={filterType}
                    onChange={(value) => {
                      setFilterType(value as 'all' | 'collection' | 'vendor');
                      setSelectedCollections(new Set());
                      setSelectedVendor('');
                      setSelectedProducts(new Set());
                    }}
                  />
                </div>

                {filterType === 'collection' && collections.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
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
                )}

                {filterType === 'vendor' && vendors.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <Select
                      label="Select Vendor"
                      options={[
                        {label: 'Choose a vendor', value: ''},
                        ...vendors.map(vendor => ({label: vendor, value: vendor}))
                      ]}
                      value={selectedVendor}
                      onChange={(value) => {
                        setSelectedVendor(value);
                        // Auto-select all products from this vendor
                        if (value) {
                          const vendorProducts = products.filter(p => p.title.startsWith(value));
                          setSelectedProducts(new Set(vendorProducts.map(p => p.id)));
                        } else {
                          setSelectedProducts(new Set());
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </Card>
          </Layout.Section>

          {/* Step 2: Product Selection */}
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    Products ({selectedProducts.size} selected)
                  </h3>
                  <Button onClick={handleSelectAll}>
                    {selectedProducts.size === filteredProducts.length ? 'Deselect All' : 'Select All'}
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

          {/* Step 3: Price Adjustment Settings */}
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
                  Step 2: Configure Price Adjustment
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
                      <Select
                        label="Adjustment Type"
                        options={[
                          {label: 'Fixed Amount ($)', value: 'fixed'},
                          {label: 'Percentage (%)', value: 'percentage'},
                        ]}
                        value={bulkPricing.adjustmentType}
                        onChange={(value) => setBulkPricing({...bulkPricing, adjustmentType: value})}
                      />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <Select
                        label="Direction"
                        options={[
                          {label: 'Increase', value: 'increase'},
                          {label: 'Decrease', value: 'decrease'},
                        ]}
                        value={bulkPricing.adjustmentDirection}
                        onChange={(value) => setBulkPricing({...bulkPricing, adjustmentDirection: value})}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label={`${bulkPricing.adjustmentDirection === 'increase' ? 'Increase' : 'Decrease'} by ${bulkPricing.adjustmentType === 'percentage' ? '(%)' : '($)'}`}
                        value={bulkPricing.adjustmentValue}
                        onChange={(value) => setBulkPricing({...bulkPricing, adjustmentValue: value})}
                        type="number"
                        placeholder={bulkPricing.adjustmentType === 'percentage' ? '10' : '5.00'}
                        autoComplete="off"
                      />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <Select
                        label="Apply To"
                        options={[
                          {label: 'Price Only', value: 'price'},
                          {label: 'Compare At Price Only', value: 'compare_price'},
                          {label: 'Both Prices', value: 'both'},
                        ]}
                        value={bulkPricing.adjustmentTarget}
                        onChange={(value) => setBulkPricing({...bulkPricing, adjustmentTarget: value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <ButtonGroup>
                    <Button onClick={() => navigate('/bulk-actions')}>
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      loading={creating}
                      onClick={createBulkAction}
                      disabled={selectedProducts.size === 0 || !bulkPricing.actionName.trim() || !bulkPricing.adjustmentValue}
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