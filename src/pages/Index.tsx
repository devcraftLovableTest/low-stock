import ShopifyAppStatus from "@/components/ShopifyAppStatus";
import ShopifyAppProvider from "@/components/ShopifyAppProvider";

interface IndexProps {
  isBulkActionsPage?: boolean;
}

const Index = ({ isBulkActionsPage = false }: IndexProps) => {
  return (
    <ShopifyAppProvider>
      <ShopifyAppStatus isBulkActionsPage={isBulkActionsPage} />
    </ShopifyAppProvider>
  );
};

export default Index;
