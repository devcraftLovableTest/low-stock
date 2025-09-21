import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import ShopifyInstallation from './ShopifyInstallation';
import ProductsDashboard from './ProductsDashboard';
import BulkActions from '../pages/BulkActions';
import { Banner, Layout, Spinner } from '@shopify/polaris';
import createApp from '@shopify/app-bridge';
import { Redirect } from '@shopify/app-bridge/actions';

interface Shop {
  id: string;
  shop_domain: string;
  shop_name: string;
  email: string;
  installed_at: string;
}

interface ShopifyAppStatusProps {
  isBulkActionsPage?: boolean;
}

const ShopifyAppStatus: React.FC<ShopifyAppStatusProps> = ({ isBulkActionsPage = false }) => {
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState('');
  

  useEffect(() => {
    checkInstallationStatus();
  }, []);

  const checkInstallationStatus = async () => {
    try {
      // Get shop domain from URL parameters (when redirected back from Shopify)
      const urlParams = new URLSearchParams(window.location.search);
      const shopDomain = urlParams.get('shop') || getShopDomainFromHost();
      
      if (shopDomain) {
        // Check if shop is installed in our database
        const { data, error } = await supabase
          .from('shops')
          .select('*')
          .eq('shop_domain', shopDomain)
          .maybeSingle();

        if (error) {
          console.error('Error checking shop status:', error);
          setError('Failed to check installation status');
        } else if (data) {
          setShop(data);
        } else if (shopDomain) {
          // Shop domain found but not installed - auto-redirect to installation
          const returnUrl = window.location.origin + window.location.pathname;
          const prepareUrl = `https://snriaelgnlnuhfuiqsdt.supabase.co/functions/v1/shopify-oauth?useraction=prepare&shop=${shopDomain}&returnUrl=${encodeURIComponent(returnUrl)}`;
          
          try {
            const response = await fetch(prepareUrl);
            const data = await response.json();
            
            if (response.ok) {
              try {
                const host = new URLSearchParams(window.location.search).get('host') || '';
                const app = createApp({ apiKey: 'b211150c38f46b557626d779ea7a3bcf', host, forceRedirect: true });
                const redirect = Redirect.create(app);
                redirect.dispatch(Redirect.Action.REMOTE, data.authUrl);
              } catch (e) {
                // Fallback for standalone or if App Bridge init fails
                window.top ? (window.top.location.href = data.authUrl) : (window.location.href = data.authUrl);
              }
            }
          } catch (e) {
            console.error('Failed to prepare OAuth:', e);
          }
          return;
        }
      }
    } catch (err) {
      console.error('Error in checkInstallationStatus:', err);
      setError('Failed to check installation status');
    } finally {
      setLoading(false);
    }
  };

  const getShopDomainFromHost = (): string | null => {
    // Try to extract shop domain from embedded app context
    const urlParams = new URLSearchParams(window.location.search);
    const host = urlParams.get('host');
    
    if (host) {
      try {
        const decodedHost = atob(host);
        const shopDomain = decodedHost.split('/')[0];
        return shopDomain.endsWith('.myshopify.com') ? shopDomain : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleInstall = (shopDomain: string) => {
    // This will redirect to OAuth, so we don't need to do anything here
    console.log('Starting installation for:', shopDomain);
  };

  if (loading) {
    return (
      <Layout>
        <Layout.Section>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '200px' 
          }}>
            <Spinner accessibilityLabel="Loading" size="large" />
          </div>
        </Layout.Section>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Layout.Section>
          <Banner tone="critical">
            <p>{error}</p>
          </Banner>
        </Layout.Section>
      </Layout>
    );
  }

  if (!shop) {
    return <ShopifyInstallation onInstall={handleInstall} />;
  }

  return isBulkActionsPage ? <BulkActions shop={shop} /> : <ProductsDashboard shop={shop} />;
};

export default ShopifyAppStatus;