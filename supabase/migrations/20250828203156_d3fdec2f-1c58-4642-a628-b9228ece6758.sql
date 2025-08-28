-- Fix security issues: Update functions with proper search_path

-- Update the timestamp function with proper security
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update the inventory status function with proper security  
CREATE OR REPLACE FUNCTION public.update_inventory_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
$$;