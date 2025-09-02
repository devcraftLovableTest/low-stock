import React, { ReactNode } from 'react';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

interface ShopifyAppProviderProps {
  children: ReactNode;
}

const ShopifyAppProvider: React.FC<ShopifyAppProviderProps> = ({ children }) => {
  return (
    <AppProvider i18n={{}} features={{ newDesignLanguage: true }}>
      {children}
    </AppProvider>
  );
};

export default ShopifyAppProvider;