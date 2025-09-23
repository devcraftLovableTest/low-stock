import ShopifyAppStatus from "@/components/ShopifyAppStatus";
import ShopifyAppProvider from "@/components/ShopifyAppProvider";

interface IndexProps {
  isBulkActionsPage?: boolean;
  isCreateBulkActionPage?: boolean;
  isBulkActionDetailPage?: boolean;
}

const Index = ({ 
  isBulkActionsPage = false, 
  isCreateBulkActionPage = false,
  isBulkActionDetailPage = false 
}: IndexProps) => {
  return (
    <ShopifyAppProvider>
      <ShopifyAppStatus 
        isBulkActionsPage={isBulkActionsPage}
        isCreateBulkActionPage={isCreateBulkActionPage}
        isBulkActionDetailPage={isBulkActionDetailPage}
      />
    </ShopifyAppProvider>
  );
};

export default Index;
