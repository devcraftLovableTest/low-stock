-- Create inventory_items table to track products
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_product_id BIGINT UNIQUE,
  shopify_variant_id BIGINT UNIQUE,
  title TEXT NOT NULL,
  sku TEXT,
  inventory_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
  shop_domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory_alerts table to track alert history
CREATE TABLE public.inventory_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock')),
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shop_domain TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for inventory_items (shop-based access)
CREATE POLICY "Shop can view their own inventory items" 
ON public.inventory_items 
FOR SELECT 
USING (true); -- For now, allow all access - will add proper shop filtering later

CREATE POLICY "Shop can create their own inventory items" 
ON public.inventory_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Shop can update their own inventory items" 
ON public.inventory_items 
FOR UPDATE 
USING (true);

CREATE POLICY "Shop can delete their own inventory items" 
ON public.inventory_items 
FOR DELETE 
USING (true);

-- Create policies for inventory_alerts
CREATE POLICY "Shop can view their own alerts" 
ON public.inventory_alerts 
FOR SELECT 
USING (true);

CREATE POLICY "Shop can create alerts" 
ON public.inventory_alerts 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically update status based on quantity
CREATE OR REPLACE FUNCTION public.update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inventory_quantity = 0 THEN
    NEW.status = 'out_of_stock';
  ELSIF NEW.inventory_quantity <= NEW.low_stock_threshold THEN
    NEW.status = 'low_stock';
  ELSE
    NEW.status = 'in_stock';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update status
CREATE TRIGGER update_inventory_status_trigger
BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_inventory_status();

-- Create indexes for better performance
CREATE INDEX idx_inventory_items_shop_domain ON public.inventory_items(shop_domain);
CREATE INDEX idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX idx_inventory_items_shopify_product_id ON public.inventory_items(shopify_product_id);
CREATE INDEX idx_inventory_alerts_shop_domain ON public.inventory_alerts(shop_domain);