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
} from '@shopify/polaris';
import { supabase } from '@/integrations/supabase/client';

interface InventoryItem {
  id: string;
  title: string;
  sku: string;
  inventory_quantity: number;
  low_stock_threshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

const InventoryDashboard: React.FC = () => {
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
      // This will be replaced with actual Shopify API calls
      // For now, we'll use sample data
      const sampleData: InventoryItem[] = [
        {
          id: '1',
          title: 'Sample Product 1',
          sku: 'SKU-001',
          inventory_quantity: 5,
          low_stock_threshold: 10,
          status: 'low_stock',
        },
        {
          id: '2', 
          title: 'Sample Product 2',
          sku: 'SKU-002',
          inventory_quantity: 25,
          low_stock_threshold: 15,
          status: 'in_stock',
        },
        {
          id: '3',
          title: 'Sample Product 3',
          sku: 'SKU-003',
          inventory_quantity: 0,
          low_stock_threshold: 5,
          status: 'out_of_stock',
        },
      ];
      
      setInventory(sampleData);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
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

  const handleAddItem = () => {
    // This would integrate with Shopify API to add/update items
    console.log('Adding new item:', newItem);
    setShowAddModal(false);
    setNewItem({ title: '', sku: '', inventory_quantity: 0, low_stock_threshold: 10 });
  };

  return (
    <Page
      title="Inventory Tracker"
      primaryAction={{
        content: 'Add Item',
        onAction: () => setShowAddModal(true),
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