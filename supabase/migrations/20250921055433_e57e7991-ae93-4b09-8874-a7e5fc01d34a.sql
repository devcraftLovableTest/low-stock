-- Create bulk_actions table to track price change batches
CREATE TABLE public.bulk_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  action_name TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'price_update',
  new_price NUMERIC,
  new_compare_at_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reverted_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  product_count INTEGER DEFAULT 0
);

-- Create bulk_action_items table to track individual products affected
CREATE TABLE public.bulk_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bulk_action_id UUID NOT NULL REFERENCES public.bulk_actions(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  original_price NUMERIC,
  original_compare_at_price NUMERIC,
  new_price NUMERIC,
  new_compare_at_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_action_items ENABLE ROW LEVEL SECURITY;

-- Create policies for bulk_actions
CREATE POLICY "Shop can view their own bulk actions" 
ON public.bulk_actions 
FOR SELECT 
USING (true);

CREATE POLICY "Shop can create bulk actions" 
ON public.bulk_actions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Shop can update their own bulk actions" 
ON public.bulk_actions 
FOR UPDATE 
USING (true);

-- Create policies for bulk_action_items
CREATE POLICY "Shop can view their own bulk action items" 
ON public.bulk_action_items 
FOR SELECT 
USING (true);

CREATE POLICY "Shop can create bulk action items" 
ON public.bulk_action_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Shop can update their own bulk action items" 
ON public.bulk_action_items 
FOR UPDATE 
USING (true);