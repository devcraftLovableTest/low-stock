-- Create oauth_states table for OAuth flow
CREATE TABLE public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  shop_domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Create policies for oauth_states table
CREATE POLICY "OAuth states are manageable by system" 
ON public.oauth_states 
FOR ALL 
USING (true);