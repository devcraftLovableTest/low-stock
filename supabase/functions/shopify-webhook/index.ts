import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InventoryUpdatePayload {
  id: number;
  title: string;
  variants: Array<{
    id: number;
    sku: string;
    inventory_quantity: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    console.log('Webhook received:', req.method, req.url)

    // Verify Shopify webhook (you should implement proper webhook verification)
    const shopDomain = req.headers.get('x-shopify-shop-domain') || 'unknown'
    const topic = req.headers.get('x-shopify-topic')

    console.log('Shop domain:', shopDomain, 'Topic:', topic)

    if (topic === 'products/update') {
      const payload: InventoryUpdatePayload = await req.json()
      console.log('Product update payload:', payload)

      // Update inventory for each variant
      for (const variant of payload.variants) {
        const { data, error } = await supabaseClient
          .from('inventory_items')
          .upsert({
            shopify_product_id: payload.id,
            shopify_variant_id: variant.id,
            title: payload.title,
            sku: variant.sku,
            inventory_quantity: variant.inventory_quantity,
            shop_domain: shopDomain,
          }, {
            onConflict: 'shopify_variant_id'
          })

        if (error) {
          console.error('Error updating inventory:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to update inventory' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Updated inventory item:', data)
      }

      return new Response(
        JSON.stringify({ message: 'Inventory updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Webhook received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})