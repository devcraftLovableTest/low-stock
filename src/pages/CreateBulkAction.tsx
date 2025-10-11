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
  ButtonGroup,
  Badge,
  Text,
  ChoiceList
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
  const [loadingCollections, setLoadingCollections] = useState(false);
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
    setLoadingCollections(true);
    try {
      console.log('Fetching collections for shop:', shop.shop_domain);
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
        console.log('Collections received:', data.collections);
        setCollections(data.collections || []);
      } else {
        console.error('Failed to fetch collections:', response.status);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoadingCollections(false);
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

  const formatPrice = (price: number | null) => {
    return price ? `$${price.toFixed(2)}` : '$0.00';
  };

  const calculatePreviewPrice = (originalPrice: number) => {
    const value = parseFloat(bulkPricing.adjustmentValue) || 0;
    if (bulkPricing.adjustmentType === 'percentage') {
      const change = originalPrice * (value / 100);
      return bulkPricing.adjustmentDirection === 'increase' 
        ? originalPrice + change 
        : originalPrice - change;
    } else {
      return bulkPricing.adjustmentDirection === 'increase' 
        ? originalPrice + value 
        : originalPrice - value;
    }
  };

  if (loading) {
    return (
      <Page title="Create Price Adjustment">
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
        title="Create Price Adjustment"
        backAction={{content: 'Back', onAction: () => navigate('/bulk-actions')}}
      >
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 380px', 
          gap: '20px', 
          padding: '20px',
          maxWidth: '100%'
        }}>
          {/* Left Column - Form Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Campaign Name Card */}
            <Card>
              <div style={{ padding: '20px' }}>
                <TextField
                  label="Campaign name"
                  value={bulkPricing.actionName}
                  onChange={(value) => setBulkPricing({ ...bulkPricing, actionName: value })}
                  placeholder="Enter the name of your discount campaign. e.g 20% off"
                  autoComplete="off"
                  helpText="For internal use only"
                />
              </div>
            </Card>

            {/* Discount Details Card */}
            <Card>
              <div style={{ padding: '20px' }}>
                <Text variant="headingMd" as="h2" fontWeight="semibold">Discount Details</Text>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '16px' }}>
                  <Select
                    label="Price Change"
                    options={[
                      { label: 'Fixed Amount', value: 'fixed' },
                      { label: 'Percentage', value: 'percentage' }
                    ]}
                    value={bulkPricing.adjustmentType}
                    onChange={(value) => setBulkPricing({ ...bulkPricing, adjustmentType: value })}
                  />
                  
                  <Select
                    label="New Price"
                    options={[
                      { label: 'Increase', value: 'increase' },
                      { label: 'Decrease', value: 'decrease' }
                    ]}
                    value={bulkPricing.adjustmentDirection}
                    onChange={(value) => setBulkPricing({ ...bulkPricing, adjustmentDirection: value })}
                  />
                  
                  <TextField
                    label=" "
                    type="number"
                    value={bulkPricing.adjustmentValue}
                    onChange={(value) => setBulkPricing({ ...bulkPricing, adjustmentValue: value })}
                    placeholder={bulkPricing.adjustmentType === 'percentage' ? '10' : '5.00'}
                    prefix={bulkPricing.adjustmentType === 'fixed' ? '$' : ''}
                    suffix={bulkPricing.adjustmentType === 'percentage' ? '%' : ''}
                    autoComplete="off"
                  />
                </div>
              </div>
            </Card>

            {/* Scope of discount Card */}
            <Card>
              <div style={{ padding: '20px' }}>
                <Text variant="headingMd" as="h2" fontWeight="semibold">Scope of discount</Text>
                
                <div style={{ marginTop: '16px' }}>
                  <ChoiceList
                    title="Filter by"
                    choices={[
                      {label: 'Entire Store', value: 'all'},
                      {label: 'Specific Collections', value: 'collection'},
                      {label: 'By Vendor', value: 'vendor'},
                    ]}
                    selected={[filterType]}
                    onChange={(value) => {
                      setFilterType(value[0] as 'all' | 'collection' | 'vendor');
                      setSelectedCollections(new Set());
                      setSelectedVendor('');
                      if (value[0] === 'all') {
                        setSelectedProducts(new Set(products.map(p => p.id)));
                      } else {
                        setSelectedProducts(new Set());
                      }
                    }}
                  />
                </div>

                {filterType === 'collection' && (
                  <div style={{ marginTop: '16px' }}>
                    {loadingCollections ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                        <Spinner size="small" />
                      </div>
                    ) : collections.length > 0 ? (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        padding: '12px',
                        border: '1px solid #e1e3e5',
                        borderRadius: '8px',
                        backgroundColor: '#f9fafb'
                      }}>
                        {collections.map((collection) => (
                          <Checkbox
                            key={collection.id}
                            label={`${collection.title} (${collection.products_count} products)`}
                            checked={selectedCollections.has(collection.id)}
                            onChange={() => handleCollectionToggle(collection.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <Banner tone="info">No collections found</Banner>
                    )}
                  </div>
                )}

                {filterType === 'vendor' && (
                  <div style={{ marginTop: '16px' }}>
                    {vendors.length > 0 ? (
                      <Select
                        label=""
                        options={[
                          { label: 'Choose a vendor', value: '' },
                          ...vendors.map(v => ({ label: v, value: v }))
                        ]}
                        value={selectedVendor}
                        onChange={(value) => {
                          setSelectedVendor(value);
                          if (value) {
                            const vendorProducts = products.filter(p => p.title.startsWith(value));
                            setSelectedProducts(new Set(vendorProducts.map(p => p.id)));
                          } else {
                            setSelectedProducts(new Set());
                          }
                        }}
                      />
                    ) : (
                      <Banner tone="info">No vendors found</Banner>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <Select
                    label="Apply to"
                    options={[
                      { label: 'Price', value: 'price' },
                      { label: 'Compare At Price', value: 'compare_price' },
                      { label: 'Both', value: 'both' }
                    ]}
                    value={bulkPricing.adjustmentTarget}
                    onChange={(value) => setBulkPricing({ ...bulkPricing, adjustmentTarget: value })}
                  />
                </div>
              </div>
            </Card>

            {/* Products Table Card */}
            <Card>
              <div style={{ padding: '16px' }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="headingMd" as="h2" fontWeight="semibold">
                    Select Products
                  </Text>
                  <Button size="slim" onClick={handleSelectAll}>
                    {selectedProducts.size === filteredProducts.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <Text variant="bodySm" as="p" tone="subdued">
                  {selectedProducts.size} of {filteredProducts.length} selected
                </Text>
              </div>

              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric']}
                headings={['', 'Product', 'SKU', 'Current Price', 'Compare At']}
                rows={filteredProducts.map((product) => [
                  <Checkbox
                    label=""
                    checked={selectedProducts.has(product.id)}
                    onChange={() => handleProductToggle(product.id)}
                  />,
                  product.title,
                  product.sku || '-',
                  formatPrice(product.price),
                  formatPrice(product.compare_at_price)
                ])}
              />
            </Card>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <Button onClick={() => navigate('/bulk-actions')}>Cancel</Button>
              <Button 
                variant="primary" 
                onClick={createBulkAction}
                loading={creating}
                disabled={!bulkPricing.actionName || selectedProducts.size === 0 || !bulkPricing.adjustmentValue}
              >
                Create Price Adjustment
              </Button>
            </div>
          </div>

          {/* Right Column - Summary Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Summary Card */}
            <Card>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <Text variant="headingMd" as="h2" fontWeight="semibold">Summary</Text>
                  <Badge tone="success">Active</Badge>
                </div>
                
                <Text variant="bodyMd" as="p" tone="subdued">
                  {bulkPricing.actionName || 'No campaign name yet'}
                </Text>

                <div style={{ 
                  backgroundColor: '#f9fafb', 
                  padding: '16px', 
                  borderRadius: '8px',
                  marginTop: '16px',
                  marginBottom: '16px'
                }}>
                  <Text variant="bodyMd" as="p" fontWeight="medium">
                    {filterType === 'all' ? 'Entire Store Price Update' : 
                     filterType === 'collection' ? 'Collection-based Price Update' : 
                     'Vendor-based Price Update'}
                  </Text>
                  <div style={{ marginTop: '4px' }}>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {selectedProducts.size} {selectedProducts.size === 1 ? 'product' : 'products'} selected
                    </Text>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <Text variant="bodySm" as="p">
                      {bulkPricing.adjustmentValue ? 
                        `${bulkPricing.adjustmentDirection === 'increase' ? '+' : '-'}${bulkPricing.adjustmentType === 'percentage' ? bulkPricing.adjustmentValue + '%' : '$' + bulkPricing.adjustmentValue} applied to ${bulkPricing.adjustmentTarget === 'price' ? 'price' : bulkPricing.adjustmentTarget === 'compare_price' ? 'compare at price' : 'both prices'}` :
                        'No adjustment configured yet'
                      }
                    </Text>
                  </div>
                </div>

                <Text variant="headingSm" as="h3" fontWeight="semibold">Details</Text>
                <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8', listStyle: 'disc' }}>
                  <li>
                    <Text variant="bodySm" as="span">
                      Applies to {filterType === 'all' ? 'entire store' : filterType === 'collection' ? `${selectedCollections.size} ${selectedCollections.size === 1 ? 'collection' : 'collections'}` : selectedVendor || 'vendor not selected'}
                    </Text>
                  </li>
                  <li>
                    <Text variant="bodySm" as="span">
                      {bulkPricing.adjustmentValue && bulkPricing.adjustmentType === 'percentage' 
                        ? `${bulkPricing.adjustmentValue}% ${bulkPricing.adjustmentDirection}`
                        : bulkPricing.adjustmentValue && bulkPricing.adjustmentType === 'fixed'
                        ? `$${bulkPricing.adjustmentValue} ${bulkPricing.adjustmentDirection}`
                        : 'No price adjustment set'}
                    </Text>
                  </li>
                  <li>
                    <Text variant="bodySm" as="span">
                      Executes immediately upon creation
                    </Text>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Discount Preview Card */}
            <Card>
              <div style={{ padding: '20px' }}>
                <Text variant="headingMd" as="h2" fontWeight="semibold">Price Preview</Text>
                
                {selectedProducts.size > 0 && bulkPricing.adjustmentValue ? (
                  <>
                    {Array.from(selectedProducts).slice(0, 3).map((productId) => {
                      const product = products.find(p => p.id === productId);
                      if (!product || !product.price) return null;
                      
                      const originalPrice = product.price;
                      const newPrice = calculatePreviewPrice(originalPrice);
                      const difference = newPrice - originalPrice;
                      const percentChange = ((difference / originalPrice) * 100).toFixed(1);
                      
                      return (
                        <div key={productId} style={{ 
                          marginTop: '16px', 
                          padding: '16px', 
                          backgroundColor: '#f9fafb', 
                          borderRadius: '8px',
                          borderLeft: '3px solid #008060'
                        }}>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {product.title.length > 40 ? product.title.substring(0, 40) + '...' : product.title}
                          </Text>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                            <Text variant="headingLg" as="span" fontWeight="bold">
                              {formatPrice(newPrice)}
                            </Text>
                            <span style={{ textDecoration: 'line-through' }}>
                              <Text variant="bodyMd" as="span" tone="subdued">
                                {formatPrice(originalPrice)}
                              </Text>
                            </span>
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <Text variant="bodySm" as="p" tone={difference > 0 ? 'critical' : 'success'}>
                              {difference > 0 ? '+' : ''}{formatPrice(Math.abs(difference))} ({difference > 0 ? '+' : ''}{percentChange}%)
                            </Text>
                          </div>
                        </div>
                      );
                    })}
                    
                    {selectedProducts.size > 3 && (
                      <div style={{ marginTop: '12px', textAlign: 'center' }}>
                        <Text variant="bodySm" as="p" tone="subdued">
                          Showing 3 of {selectedProducts.size} products
                        </Text>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ marginTop: '16px', padding: '32px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Select products and set adjustment values to see price preview
                    </Text>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Page>
      {toast}
    </Frame>
  );
};

export default CreateBulkAction;