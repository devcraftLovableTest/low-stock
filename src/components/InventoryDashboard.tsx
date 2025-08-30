import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Button,
  TextField,
  Select,
  Banner,
  Modal,
  FormLayout,
  Spinner,
} from '@shopify/polaris';
import { supabase } from '@/integrations/supabase/client';

interface InventoryItem {
  id: string;
  title: string;
  sku: string;
  inventory_quantity: number;
  low_stock_threshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  shopify_product_id?: number;
  shopify_variant_id?: number;
  shop_domain?: string;
  created_at?: string;
  updated_at?: string;
}

interface Shop {
  id: string;
  shop_domain: string;
  shop_name: string;
  email: string;
  installed_at: string;
}

interface InventoryDashboardProps {
  shop: Shop;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ shop }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    sku: '',
    inventory_quantity: 0,
    low_stock_threshold: 10,
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      
      // Fetch from Supabase database for this specific shop
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('shop_domain', shop.shop_domain)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inventory:', error);
        setInventory([]);
      } else {
        // Map database data to our interface
        const mappedData: InventoryItem[] = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          sku: item.sku || '',
          inventory_quantity: item.inventory_quantity,
          low_stock_threshold: item.low_stock_threshold,
          status: item.status as 'in_stock' | 'low_stock' | 'out_of_stock',
          shopify_product_id: item.shopify_product_id,
          shopify_variant_id: item.shopify_variant_id,
          shop_domain: item.shop_domain,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        setInventory(mappedData);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateThreshold = async (itemId: string, newThreshold: number) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ low_stock_threshold: newThreshold })
        .eq('id', itemId);

      if (error) {
        console.error('Error updating threshold:', error);
        return;
      }

      // Update local state
      setInventory(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, low_stock_threshold: newThreshold }
          : item
      ));
    } catch (error) {
      console.error('Error updating threshold:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge tone="success">In Stock</Badge>;
      case 'low_stock':
        return <Badge tone="warning">Low Stock</Badge>;
      case 'out_of_stock':
        return <Badge tone="critical">Out of Stock</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const rows = filteredInventory.map(item => [
    item.title,
    item.sku,
    item.inventory_quantity.toString(),
    item.low_stock_threshold.toString(),
    getStatusBadge(item.status),
  ]);

  const lowStockCount = inventory.filter(item => item.status === 'low_stock').length;
  const outOfStockCount = inventory.filter(item => item.status === 'out_of_stock').length;

  const handleAddItem = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          title: newItem.title,
          sku: newItem.sku,
          inventory_quantity: newItem.inventory_quantity,
          low_stock_threshold: newItem.low_stock_threshold,
          shop_domain: shop.shop_domain, // Use the current shop's domain
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding item:', error);
        return;
      }

      // Add to local state
      if (data) {
        const mappedNewItem: InventoryItem = {
          id: data.id,
          title: data.title,
          sku: data.sku || '',
          inventory_quantity: data.inventory_quantity,
          low_stock_threshold: data.low_stock_threshold,
          status: data.status as 'in_stock' | 'low_stock' | 'out_of_stock',
          shopify_product_id: data.shopify_product_id,
          shopify_variant_id: data.shopify_variant_id,
          shop_domain: data.shop_domain,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setInventory(prev => [mappedNewItem, ...prev]);
      }
      
      setShowAddModal(false);
      setNewItem({ title: '', sku: '', inventory_quantity: 0, low_stock_threshold: 10 });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  return (
    <Page
      title={`Inventory Tracker - ${shop.shop_name || shop.shop_domain}`}
      primaryAction={{
        content: 'Sync with Shopify',
        onAction: async () => {
          // Add sync functionality here
          await fetchInventory();
        },
      }}
    >
      <Layout>
        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <Layout.Section>
            <Banner
              title="Inventory Alerts"
              tone={outOfStockCount > 0 ? 'critical' : 'warning'}
            >
              <p>
                {outOfStockCount > 0 && `${outOfStockCount} items are out of stock. `}
                {lowStockCount > 0 && `${lowStockCount} items have low stock.`}
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search products"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search by title or SKU"
                    autoComplete="off"
                  />
                </div>
                <div style={{ width: '200px' }}>
                  <Select
                    label="Filter by status"
                    options={[
                      { label: 'All', value: 'all' },
                      { label: 'In Stock', value: 'in_stock' },
                      { label: 'Low Stock', value: 'low_stock' },
                      { label: 'Out of Stock', value: 'out_of_stock' },
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                </div>
              </div>

              <DataTable
                columnContentTypes={['text', 'text', 'numeric', 'numeric', 'text']}
                headings={['Product', 'SKU', 'Quantity', 'Threshold', 'Status']}
                rows={rows}
              />
            </div>
          </Card>
        </Layout.Section>

        <Modal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Item"
          primaryAction={{
            content: 'Add Item',
            onAction: handleAddItem,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setShowAddModal(false),
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Product Title"
                value={newItem.title}
                onChange={(value) => setNewItem({ ...newItem, title: value })}
                autoComplete="off"
              />
              <TextField
                label="SKU"
                value={newItem.sku}
                onChange={(value) => setNewItem({ ...newItem, sku: value })}
                autoComplete="off"
              />
              <TextField
                label="Current Quantity"
                type="number"
                value={newItem.inventory_quantity.toString()}
                onChange={(value) => setNewItem({ ...newItem, inventory_quantity: parseInt(value) || 0 })}
                autoComplete="off"
              />
              <TextField
                label="Low Stock Threshold"
                type="number"
                value={newItem.low_stock_threshold.toString()}
                onChange={(value) => setNewItem({ ...newItem, low_stock_threshold: parseInt(value) || 0 })}
                autoComplete="off"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      </Layout>
    </Page>
  );
};

export default InventoryDashboard;