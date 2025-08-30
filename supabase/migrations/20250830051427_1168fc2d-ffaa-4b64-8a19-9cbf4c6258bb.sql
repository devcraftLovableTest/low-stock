-- Create shops table to store installed shop credentials
CREATE TABLE public.shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  shop_name TEXT,
  email TEXT,
  installed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Create policies for shops table
CREATE POLICY "Shops are viewable by system" 
ON public.shops 
FOR SELECT 
USING (true);

CREATE POLICY "Shops can be created by system" 
ON public.shops 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Shops can be updated by system" 
ON public.shops 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_shops_updated_at
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update inventory_items to reference shops table
ALTER TABLE public.inventory_items 
ADD COLUMN shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;