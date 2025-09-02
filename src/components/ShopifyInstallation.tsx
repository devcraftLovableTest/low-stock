import React, { useState } from 'react';
import { Card, Layout, Button, TextField, Banner, Text } from '@shopify/polaris';
import createApp from '@shopify/app-bridge';
import { Redirect } from '@shopify/app-bridge/actions';

interface ShopifyInstallationProps {
  onInstall: (shopDomain: string) => void;
}

const ShopifyInstallation: React.FC<ShopifyInstallationProps> = ({ onInstall }) => {
  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInstall = async () => {
    if (!shopDomain.trim()) {
      setError('Please enter your shop domain');
      return;
    }

    // Clean the domain input
    const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\.myshopify\.com.*$/, '');
    const fullDomain = `${cleanDomain}.myshopify.com`;

    setLoading(true);
    setError('');

    try {
      // Redirect to OAuth installation using App Bridge to escape iframe
      const returnUrl = window.location.origin + window.location.pathname
      const installUrl = `https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-oauth?action=install&shop=${fullDomain}&returnUrl=${encodeURIComponent(returnUrl)}`;
      try {
        const host = new URLSearchParams(window.location.search).get('host') || '';
        const app = createApp({ apiKey: 'b211150c38f46b557626d779ea7a3bcf', host, forceRedirect: true });
        const redirect = Redirect.create(app);
        redirect.dispatch(Redirect.Action.REMOTE, installUrl);
      } catch (e) {
        // Fallback for standalone
        window.top ? (window.top.location.href = installUrl) : (window.location.href = installUrl);
      }
    } catch (err) {
      setError('Failed to start installation process');
      setLoading(false);
    }
  };

  const handleShopDomainChange = (value: string) => {
    setShopDomain(value);
    setError('');
  };

  return (
    <Layout>
      <Layout.Section>
        <Card>
          <div style={{ padding: '20px' }}>
            <Text variant="headingLg" as="h1">
              Install Inventory Tracker
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text variant="bodyMd" as="p">
                Connect your Shopify store to start tracking inventory levels and receive low stock alerts.
              </Text>
            </div>

            {error && (
              <div style={{ marginTop: '16px' }}>
                <Banner tone="critical">
                  <p>{error}</p>
                </Banner>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <TextField
                label="Shop Domain"
                value={shopDomain}
                onChange={handleShopDomainChange}
                placeholder="your-store-name"
                helpText="Enter your shop name (without .myshopify.com)"
                autoComplete="off"
                disabled={loading}
                suffix=".myshopify.com"
              />
            </div>

            <div style={{ marginTop: '24px' }}>
              <Button
                variant="primary"
                onClick={handleInstall}
                loading={loading}
                disabled={!shopDomain.trim() || loading}
                size="large"
              >
                Install App
              </Button>
            </div>

            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
              <Text variant="headingSm" as="h3">
                What happens next?
              </Text>
              <div style={{ marginTop: '8px' }}>
                <Text variant="bodyMd" as="p">
                  1. You'll be redirected to your Shopify admin to authorize the app
                </Text>
                <Text variant="bodyMd" as="p">
                  2. Grant permissions to read and manage your inventory
                </Text>
                <Text variant="bodyMd" as="p">
                  3. Return to the app to start tracking your inventory
                </Text>
              </div>
            </div>
          </div>
        </Card>
      </Layout.Section>
    </Layout>
  );
};

export default ShopifyInstallation;