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

    // Check if request has body for JSON parsing
    let requestBody = {}
    try {
      const text = await req.text()
      if (text) {
        requestBody = JSON.parse(text)
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, shopDomain, accessToken } = requestBody
    
    console.log('Shopify API request:', { action, shopDomain })

    if (action === 'fetch-products') {
      if (!shopDomain) {
        return new Response(
          JSON.stringify({ error: 'Missing shopDomain' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Resolve access token from DB if not provided
      let token = accessToken as string | undefined
      let shopId: string | null = null

      if (!token) {
        console.log('No token provided, fetching from database for shop:', shopDomain)
        const { data: shopRow, error: shopErr } = await supabaseClient
          .from('shops')
          .select('id, access_token')
          .eq('shop_domain', shopDomain)
          .maybeSingle()

        if (shopErr) {
          console.error('Database error fetching shop:', shopErr)
          return new Response(
            JSON.stringify({ error: 'Database error fetching shop' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!shopRow) {
          console.error('Shop not found in database:', shopDomain)
          return new Response(
            JSON.stringify({ error: 'Shop not found. Please install the app first.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!shopRow.access_token) {
          console.error('No access token found for shop:', shopDomain)
          return new Response(
            JSON.stringify({ error: 'Access token missing. Please reinstall the app.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        token = shopRow.access_token
        shopId = shopRow.id
        console.log('Retrieved token from database, length:', token.length, 'for shop:', shopDomain)
      } else {
        console.log('Using provided token, length:', token.length)
        // Fetch shop id for upserts
        const { data: shopRow } = await supabaseClient
          .from('shops')
          .select('id')
          .eq('shop_domain', shopDomain)
          .maybeSingle()
        shopId = shopRow?.id ?? null
      }

      // Validate token format
      if (!token || token.length < 10) {
        console.error('Invalid token format, length:', token?.length || 0)
        return new Response(
          JSON.stringify({ error: 'Invalid access token format' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Fetching products via GraphQL for shop:', shopDomain, 'with token prefix:', token.substring(0, 8) + '...')

      const gqlQuery = `
        query FetchProducts($first:Int!, $variantsFirst:Int!){
          products(first: $first) {
            edges {
              node {
                id
                title
                variants(first: $variantsFirst) {
                  edges {
                    node {
                      id
                      sku
                      inventoryQuantity
                      price { amount }
                      compareAtPrice { amount }
                    }
                  }
                }
              }
            }
          }
        }
      `

      const shopifyResponse = await fetch(`https://${shopDomain}/admin/api/2025-07/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: gqlQuery, variables: { first: 100, variantsFirst: 100 } })
      })

      console.log('Shopify GraphQL response status:', shopifyResponse.status)
      
      if (!shopifyResponse.ok) {
        const errorText = await shopifyResponse.text()
        console.error('Shopify API HTTP error:', {
          status: shopifyResponse.status,
          statusText: shopifyResponse.statusText,
          body: errorText
        })
        
        if (shopifyResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Invalid or expired access token. Please reinstall the app.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        return new Response(
          JSON.stringify({ error: `Shopify API error: ${shopifyResponse.status} - ${errorText}` }),
          { status: shopifyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const gql = await shopifyResponse.json().catch(async (parseError) => {
        console.error('JSON parsing error:', parseError)
        const text = await shopifyResponse.text()
        console.error('Response text:', text)
        return { parseError: text }
      })

      if ((gql as any).errors) {
        console.error('Shopify GraphQL errors:', (gql as any).errors)
        const errorMessage = (gql as any).errors.map((e: any) => e.message).join(', ')
        return new Response(
          JSON.stringify({ error: `GraphQL errors: ${errorMessage}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if ((gql as any).parseError) {
        console.error('Response parsing error:', (gql as any).parseError)
        return new Response(
          JSON.stringify({ error: 'Invalid response from Shopify API' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const edges = (gql as any).data?.products?.edges || []
      console.log('Fetched products (edges):', edges.length)

      // Helper to extract numeric id from GID (gid://shopify/Product/123)
      const extractNumericId = (gid: string) => {
        const parts = gid?.split('/') || []
        const last = parts[parts.length - 1]
        const n = parseInt(last, 10)
        return isNaN(n) ? null : n
      }

      // Store/update products in Supabase
      for (const pEdge of edges) {
        const product = pEdge.node
        const productId = extractNumericId(product.id)
        const vEdges = product.variants?.edges || []
        for (const vEdge of vEdges) {
          const variant = vEdge.node
          const variantId = extractNumericId(variant.id)
          const priceAmount = variant.price?.amount ? parseFloat(variant.price.amount) : null
          const compareAmount = variant.compareAtPrice?.amount ? parseFloat(variant.compareAtPrice.amount) : null
          const invQty = typeof variant.inventoryQuantity === 'number' ? variant.inventoryQuantity : 0

          const { error } = await supabaseClient
            .from('inventory_items')
            .upsert({
              shopify_product_id: productId,
              shopify_variant_id: variantId,
              title: product.title,
              sku: variant.sku,
              inventory_quantity: invQty,
              price: priceAmount,
              compare_at_price: compareAmount,
              shop_domain: shopDomain,
              shop_id: shopId,
            }, {
              onConflict: 'shopify_variant_id'
            })

          if (error) {
            console.error('Error storing product:', error)
          }
        }
      }

      return new Response(
        JSON.stringify({ products: edges.length }),
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
      const { itemId, threshold } = requestBody
      
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
      const { itemId, price, compareAtPrice } = requestBody
      
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