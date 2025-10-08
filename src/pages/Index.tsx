import ShopifyAppStatus from "@/components/ShopifyAppStatus";
import ShopifyAppProvider from "@/components/ShopifyAppProvider";

interface IndexProps {
  isBulkActionsPage?: boolean;
  isCreateBulkActionPage?: boolean;
  isBulkActionDetailPage?: boolean;
  isProductsPage?: boolean;
}

const Index = ({ 
  isBulkActionsPage = false, 
  isCreateBulkActionPage = false,
  isBulkActionDetailPage = false,
  isProductsPage = false
}: IndexProps) => {
  return (
    <ShopifyAppProvider>
      <ShopifyAppStatus 
        isBulkActionsPage={isBulkActionsPage}
        isCreateBulkActionPage={isCreateBulkActionPage}
        isBulkActionDetailPage={isBulkActionDetailPage}
        isProductsPage={isProductsPage}
      />
    </ShopifyAppProvider>
  );
};

export default Index;
