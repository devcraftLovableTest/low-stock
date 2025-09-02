import ShopifyAppStatus from "@/components/ShopifyAppStatus";
import ShopifyAppProvider from "@/components/ShopifyAppProvider";

const Index = () => {
  return (
    <ShopifyAppProvider>
      <ShopifyAppStatus />
    </ShopifyAppProvider>
  );
};

export default Index;
