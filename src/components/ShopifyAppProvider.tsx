import React, { ReactNode } from 'react';
import { AppProvider } from '@shopify/polaris';
import createApp from '@shopify/app-bridge';
import { Banner, Layout } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

interface ShopifyAppProviderProps {
  children: ReactNode;
}

const ShopifyAppProvider: React.FC<ShopifyAppProviderProps> = ({ children }) => {
  const appBridgeConfig = {
    apiKey: 'b211150c38f46b557626d779ea7a3bcf',
    host: new URLSearchParams(location.search).get('host') || '',
    forceRedirect: true,
  };

  // Check if we're running in Shopify admin context
  const isEmbedded = new URLSearchParams(location.search).get('embedded') === '1';

  if (!isEmbedded) {
    return (
      <AppProvider i18n={{}}>
        <Layout>
          <Layout.Section>
            <Banner
              title="This app must be accessed through Shopify Admin"
              tone="warning"
            >
              <p>Please access this app through your Shopify admin panel.</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </AppProvider>
    );
  }

  // Initialize App Bridge
  const app = createApp(appBridgeConfig);

  return (
    <AppProvider i18n={{}} features={{ newDesignLanguage: true }}>
      {children}
    </AppProvider>
  );
};

export default ShopifyAppProvider;