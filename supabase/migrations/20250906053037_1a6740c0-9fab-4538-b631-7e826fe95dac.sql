-- Add missing column to store return URL used during OAuth prepare step
ALTER TABLE public.oauth_states
ADD COLUMN IF NOT EXISTS return_url text;

-- Optional: speed up lookups on (state, shop_domain)
CREATE INDEX IF NOT EXISTS idx_oauth_states_state_shop
  ON public.oauth_states (state, shop_domain);