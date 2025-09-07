import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { action, shopDomain, accessToken } = await req.json()
    
    console.log('Shopify API request:', { action, shopDomain })

    if (action === 'fetch-products') {
      // Fetch products from Shopify Admin API
      const shopifyResponse = await fetch(`https://${shopDomain}/admin/api/2025-07/products.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (!shopifyResponse.ok) {
        throw new Error(`Shopify API error: ${shopifyResponse.status}`)
      }

      const data = await shopifyResponse.json()
      console.log('Fetched products from Shopify:', data.products?.length || 0)

      // Get shop from database
      const { data: shop } = await supabaseClient
        .from('shops')
        .select('id')
        .eq('shop_domain', shopDomain)
        .single()

      if (!shop) {
        throw new Error('Shop not found')
      }

      // Store/update products in Supabase
      for (const product of data.products || []) {
        for (const variant of product.variants || []) {
          const { error } = await supabaseClient
            .from('inventory_items')
            .upsert({
              shopify_product_id: product.id,
              shopify_variant_id: variant.id,
              title: product.title,
              sku: variant.sku,
              inventory_quantity: variant.inventory_quantity || 0,
              price: variant.price ? parseFloat(variant.price) : null,
              compare_at_price: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
              shop_domain: shopDomain,
              shop_id: shop.id,
            }, {
              onConflict: 'shopify_variant_id'
            })

          if (error) {
            console.error('Error storing product:', error)
          }
        }
      }

      return new Response(
        JSON.stringify({ products: data.products }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get-inventory') {
      const { data, error } = await supabaseClient
        .from('inventory_items')
        .select('*')
        .eq('shop_domain', shopDomain)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return new Response(
        JSON.stringify({ inventory: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update-threshold') {
      const { itemId, threshold } = await req.json()
      
      const { error } = await supabaseClient
        .from('inventory_items')
        .update({ low_stock_threshold: threshold })
        .eq('id', itemId)
        .eq('shop_domain', shopDomain)

      if (error) {
        throw error
      }

      return new Response(
        JSON.stringify({ message: 'Threshold updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update-prices') {
      const { itemId, price, compareAtPrice } = await req.json()
      
      const { error } = await supabaseClient
        .from('inventory_items')
        .update({ 
          price: price ? parseFloat(price) : null,
          compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null
        })
        .eq('id', itemId)
        .eq('shop_domain', shopDomain)

      if (error) {
        throw error
      }

      return new Response(
        JSON.stringify({ message: 'Prices updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('API error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})