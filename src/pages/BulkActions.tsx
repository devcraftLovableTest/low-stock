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
  Frame
} from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";

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

interface BulkActionsProps {
  shop: Shop;
}

const BulkActions: React.FC<BulkActionsProps> = ({ shop }) => {
  const navigate = useNavigate();
  const [bulkActions, setBulkActions] = useState<BulkAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetchBulkActions();
  }, [shop.shop_domain]);

  const fetchBulkActions = async () => {
    try {
      const { data, error } = await supabase
        .from('bulk_actions')
        .select('*')
        .eq('shop_domain', shop.shop_domain)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bulk actions:', error);
        setToastMessage('Error loading bulk actions');
        setShowToast(true);
      } else {
        setBulkActions(data || []);
      }
    } catch (error) {
      console.error('Error fetching bulk actions:', error);
      setToastMessage('Error loading bulk actions');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const revertBulkAction = async (actionId: string) => {
    try {
      const response = await fetch('https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revert-bulk-action',
          shopDomain: shop.shop_domain,
          bulkActionId: actionId,
        }),
      });

      if (response.ok) {
        // Refresh the list
        await fetchBulkActions();
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

  const rows = bulkActions.map((action) => [
    <Button 
      variant="plain" 
      onClick={() => navigate(`/bulk-actions/${action.id}`)}
    >
      {action.action_name}
    </Button>,
    action.new_price ? `$${action.new_price.toFixed(2)}` : '-',
    action.new_compare_at_price ? `$${action.new_compare_at_price.toFixed(2)}` : '-',
    action.product_count.toString(),
    formatDate(action.created_at),
    action.reverted_at ? (
      <span style={{ color: '#D72C0D', fontWeight: 'bold' }}>
        Reverted on {formatDate(action.reverted_at)}
      </span>
    ) : (
      <Button 
        size="slim" 
        variant="primary"
        onClick={() => revertBulkAction(action.id)}
      >
        Revert to Original
      </Button>
    )
  ]);

  if (loading) {
    return (
      <Page title="Bulk Actions History">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px' 
              }}>
                <Spinner accessibilityLabel="Loading bulk actions" size="large" />
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
        title="Bulk Actions History"
        backAction={{content: 'Products', onAction: () => navigate('/')}}
        primaryAction={{
          content: 'Create New Bulk Action',
          onAction: () => navigate('/bulk-actions/create')
        }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Price Change History
                </h2>
                <p style={{ color: '#6B7280', marginBottom: '16px' }}>
                  Track and manage your bulk pricing actions. You can revert any action to restore original prices.
                </p>
              </div>
            </Card>
          </Layout.Section>

          <Layout.Section>
            {bulkActions.length === 0 ? (
              <Banner tone="info">
                <p>No bulk actions found. Create your first bulk pricing action from the Products page.</p>
              </Banner>
            ) : (
              <Card>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                  headings={['Action Name', 'New Price', 'Compare At Price', 'Products', 'Date', 'Status']}
                  rows={rows}
                />
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </Page>
      {toast}
    </Frame>
  );
};

export default BulkActions;