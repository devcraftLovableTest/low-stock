-- Add price fields to inventory_items table for product pricing management
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10,2);

-- Update existing function to handle price status updates
CREATE OR REPLACE FUNCTION public.update_inventory_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$