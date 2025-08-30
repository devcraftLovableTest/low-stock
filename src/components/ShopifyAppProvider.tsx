import React, { ReactNode } from 'react';
import { AppProvider } from '@shopify/polaris';
import createApp from '@shopify/app-bridge';
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

  // Check if we're running in Shopify admin context or standalone
  const isEmbedded = new URLSearchParams(location.search).get('embedded') === '1';
  const hasHost = new URLSearchParams(location.search).get('host');

  // Allow standalone access for installation flow
  if (!isEmbedded && !hasHost) {
    return (
      <AppProvider i18n={{}} features={{ newDesignLanguage: true }}>
        {children}
      </AppProvider>
    );
  }

  // Initialize App Bridge for embedded context
  const app = createApp(appBridgeConfig);

  return (
    <AppProvider i18n={{}} features={{ newDesignLanguage: true }}>
      {children}
    </AppProvider>
  );
};

export default ShopifyAppProvider;