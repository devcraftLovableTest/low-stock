import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Layout, Card, BlockStack, InlineGrid, Text, Button, Banner, Spinner } from '@shopify/polaris';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Package, TrendingUp, AlertTriangle, History, DollarSign, ShoppingCart } from 'lucide-react';

interface Shop {
  id: string;
  shop_domain: string;
  shop_name: string;
  email: string;
  installed_at: string;
}

interface DashboardProps {
  shop: Shop;
}

interface Stats {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  totalBulkActions: number;
  recentBulkActions: number;
  averagePrice: number;
}

const Dashboard: React.FC<DashboardProps> = ({ shop }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    totalBulkActions: 0,
    recentBulkActions: 0,
    averagePrice: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, [shop.shop_domain]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch inventory stats
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('status, price')
        .eq('shop_domain', shop.shop_domain);

      if (inventoryError) throw inventoryError;

      // Fetch bulk actions
      const { data: bulkActionsData, error: bulkActionsError } = await supabase
        .from('bulk_actions')
        .select('created_at')
        .eq('shop_domain', shop.shop_domain);

      if (bulkActionsError) throw bulkActionsError;

      // Calculate stats
      const totalProducts = inventoryData?.length || 0;
      const lowStock = inventoryData?.filter(item => item.status === 'low_stock').length || 0;
      const outOfStock = inventoryData?.filter(item => item.status === 'out_of_stock').length || 0;
      
      const prices = inventoryData?.filter(item => item.price).map(item => Number(item.price)) || [];
      const averagePrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;

      const totalBulkActions = bulkActionsData?.length || 0;
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);
      const recentBulkActions = bulkActionsData?.filter(action => 
        new Date(action.created_at) > last7Days
      ).length || 0;

      setStats({
        totalProducts,
        lowStock,
        outOfStock,
        totalBulkActions,
        recentBulkActions,
        averagePrice,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stockStatusData = [
    { name: 'In Stock', value: stats.totalProducts - stats.lowStock - stats.outOfStock, color: '#16A34A' },
    { name: 'Low Stock', value: stats.lowStock, color: '#EAB308' },
    { name: 'Out of Stock', value: stats.outOfStock, color: '#DC2626' },
  ];

  const activityData = [
    { name: 'Total Products', value: stats.totalProducts },
    { name: 'Bulk Actions', value: stats.totalBulkActions },
    { name: 'Recent Actions', value: stats.recentBulkActions },
  ];

  if (loading) {
    return (
      <Page title={`Dashboard - ${shop.shop_name || shop.shop_domain}`}>
        <Layout>
          <Layout.Section>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Spinner accessibilityLabel="Loading dashboard" size="large" />
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page 
      title={`Dashboard - ${shop.shop_name || shop.shop_domain}`}
      subtitle="Overview of your inventory and pricing management"
    >
      <Layout>
        {(stats.lowStock > 0 || stats.outOfStock > 0) && (
          <Layout.Section>
            <Banner tone={stats.outOfStock > 0 ? 'critical' : 'warning'}>
              <p>
                {stats.outOfStock > 0 && `${stats.outOfStock} products are out of stock. `}
                {stats.lowStock > 0 && `${stats.lowStock} products have low stock.`}
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    backgroundColor: '#EEF2FF', 
                    padding: '12px', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Package size={24} color="#4F46E5" />
                  </div>
                  <div>
                    <Text as="p" variant="headingMd">{stats.totalProducts}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Total Products</Text>
                  </div>
                </div>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    backgroundColor: '#FEF3C7', 
                    padding: '12px', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertTriangle size={24} color="#F59E0B" />
                  </div>
                  <div>
                    <Text as="p" variant="headingMd">{stats.lowStock}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Low Stock Items</Text>
                  </div>
                </div>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    backgroundColor: '#DCFCE7', 
                    padding: '12px', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <DollarSign size={24} color="#16A34A" />
                  </div>
                  <div>
                    <Text as="p" variant="headingMd">${stats.averagePrice.toFixed(2)}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Average Price</Text>
                  </div>
                </div>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    backgroundColor: '#F3E8FF', 
                    padding: '12px', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <History size={24} color="#9333EA" />
                  </div>
                  <div>
                    <Text as="p" variant="headingMd">{stats.recentBulkActions}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Recent Actions (7d)</Text>
                  </div>
                </div>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, lg: 2 }} gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Inventory Status</Text>
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stockStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Activity Overview</Text>
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#4F46E5" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Quick Actions</Text>
              <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
                <Button 
                  variant="primary" 
                  onClick={() => navigate('/products')}
                  icon={<ShoppingCart size={20} />}
                >
                  View All Products
                </Button>
                <Button 
                  onClick={() => navigate('/bulk-actions/create')}
                  icon={<TrendingUp size={20} />}
                >
                  Create Bulk Action
                </Button>
                <Button 
                  onClick={() => navigate('/bulk-actions')}
                  icon={<History size={20} />}
                >
                  View History
                </Button>
                <Button onClick={fetchDashboardData}>
                  Refresh Data
                </Button>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default Dashboard;
