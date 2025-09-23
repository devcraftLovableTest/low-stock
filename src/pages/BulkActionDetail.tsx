import React, { useEffect, useState } from 'react';
import { 
  Page, 
  Card, 
  DataTable, 
  Button, 
  Layout,
  Banner,
  Spinner,
  Toast,
  Frame,
  Badge
} from '@shopify/polaris';
import { supabase } from "@/integrations/supabase/client";

interface BulkActionItem {
  id: string;
  inventory_item_id: string;
  original_price: number | null;
  original_compare_at_price: number | null;
  new_price: number | null;
  new_compare_at_price: number | null;
  title: string;
  sku: string | null;
}

interface BulkAction {
  id: string;
  action_name: string;
  new_price: number | null;
  new_compare_at_price: number | null;
  created_at: string;
  reverted_at: string | null;
  product_count: number;
  shop_domain: string;
}

interface Shop {
  id: string;
  shop_domain: string;
  shop_name: string;
}

interface BulkActionDetailProps {
  shop: Shop;
  bulkActionId: string;
}

const BulkActionDetail: React.FC<BulkActionDetailProps> = ({ shop, bulkActionId }) => {
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkActionItems, setBulkActionItems] = useState<BulkActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchBulkActionDetails();
  }, [bulkActionId, shop.shop_domain]);

  const fetchBulkActionDetails = async () => {
    try {
      // Fetch bulk action details
      const { data: actionData, error: actionError } = await supabase
        .from('bulk_actions')
        .select('*')
        .eq('id', bulkActionId)
        .eq('shop_domain', shop.shop_domain)
        .single();

      if (actionError) {
        console.error('Error fetching bulk action:', actionError);
        setToastMessage('Error loading bulk action details');
        setShowToast(true);
        return;
      }

      setBulkAction(actionData);

      // Fetch bulk action items with product details
      const { data: itemsData, error: itemsError } = await supabase
        .from('bulk_action_items')
        .select(`
          *,
          inventory_items!inner(title, sku)
        `)
        .eq('bulk_action_id', bulkActionId);

      if (itemsError) {
        console.error('Error fetching bulk action items:', itemsError);
        setToastMessage('Error loading bulk action items');
        setShowToast(true);
      } else {
        const formattedItems = itemsData.map(item => ({
          ...item,
          title: item.inventory_items.title,
          sku: item.inventory_items.sku
        }));
        setBulkActionItems(formattedItems);
      }
    } catch (error) {
      console.error('Error fetching bulk action details:', error);
      setToastMessage('Error loading bulk action details');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const revertBulkAction = async () => {
    if (!bulkAction) return;

    setReverting(true);
    try {
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revert-bulk-action',
          shopDomain: shop.shop_domain,
          bulkActionId: bulkAction.id,
        }),
      });

      if (response.ok) {
        await fetchBulkActionDetails(); // Refresh data
        setToastMessage('Bulk action reverted successfully!');
        setShowToast(true);
      } else {
        setToastMessage('Error reverting bulk action');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error reverting bulk action:', error);
      setToastMessage('Error reverting bulk action');
      setShowToast(true);
    } finally {
      setReverting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number | null) => {
    return price ? `$${price.toFixed(2)}` : '-';
  };

  if (loading) {
    return (
      <Page title="Bulk Action Details">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px' 
              }}>
                <Spinner accessibilityLabel="Loading bulk action details" size="large" />
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!bulkAction) {
    return (
      <Page title="Bulk Action Details">
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              <p>Bulk action not found</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const rows = bulkActionItems.map((item) => [
    item.title,
    item.sku || '-',
    formatPrice(item.original_price),
    formatPrice(item.original_compare_at_price),
    formatPrice(item.new_price),
    formatPrice(item.new_compare_at_price),
  ]);

  const toast = showToast ? (
    <Toast
      content={toastMessage}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  return (
    <Frame>
      <Page 
        title={bulkAction.action_name}
        backAction={{content: 'Back to Bulk Actions', onAction: () => window.location.href = '/bulk-actions'}}
        primaryAction={
          !bulkAction.reverted_at ? {
            content: 'Revert to Original Prices',
            onAction: revertBulkAction,
            loading: reverting,
            destructive: true
          } : undefined
        }
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                      {bulkAction.action_name}
                    </h2>
                    <p style={{ color: '#6B7280' }}>
                      Created on {formatDate(bulkAction.created_at)}
                    </p>
                  </div>
                  
                  {bulkAction.reverted_at ? (
                    <Badge tone="critical">{`Reverted on ${formatDate(bulkAction.reverted_at)}`}</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                  <Card>
                    <div style={{ padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>
                        {bulkAction.product_count}
                      </p>
                      <p style={{ fontSize: '14px', color: '#6B7280' }}>Products Updated</p>
                    </div>
                  </Card>
                  
                  <Card>
                    <div style={{ padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>
                        {formatPrice(bulkAction.new_price)}
                      </p>
                      <p style={{ fontSize: '14px', color: '#6B7280' }}>New Price</p>
                    </div>
                  </Card>
                  
                  <Card>
                    <div style={{ padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>
                        {formatPrice(bulkAction.new_compare_at_price)}
                      </p>
                      <p style={{ fontSize: '14px', color: '#6B7280' }}>New Compare At Price</p>
                    </div>
                  </Card>
                </div>
              </div>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                  Affected Products
                </h3>
              </div>
              
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Product', 'SKU', 'Original Price', 'Original Compare At', 'New Price', 'New Compare At']}
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

export default BulkActionDetail;