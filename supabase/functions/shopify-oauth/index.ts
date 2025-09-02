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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (action === 'install') {
      const shop = url.searchParams.get('shop')
      
      if (!shop) {
        return new Response('Missing shop parameter', { status: 400 })
      }

      const clientId = 'b211150c38f46b557626d779ea7a3bcf'
      const scopes = 'read_products,write_products,read_inventory,write_inventory'
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-oauth?action=callback`
      const state = crypto.randomUUID()

      // Store state for verification
      await supabaseClient
        .from('oauth_states')
        .insert({ state, shop_domain: shop, created_at: new Date().toISOString() })

      const authUrl = `https://${shop}/admin/oauth/authorize?` +
        `client_id=${clientId}&` +
        `scope=${scopes}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`

      return new Response(null, {
        status: 302,
        headers: {
          'Location': authUrl,
          ...corsHeaders
        }
      })
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const shop = url.searchParams.get('shop')

      if (!code || !state || !shop) {
        return new Response('Missing required parameters', { status: 400 })
      }

      // Verify state
      const { data: stateData } = await supabaseClient
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('shop_domain', shop)
        .single()

      if (!stateData) {
        return new Response('Invalid state parameter', { status: 400 })
      }

      // Exchange code for access token
      const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'b211150c38f46b557626d779ea7a3bcf',
          client_secret: Deno.env.get('SHOPIFY_CLIENT_SECRET'),
          code,
        }),
      })

      const tokenData = await tokenResponse.json()

      if (!tokenData.access_token) {
        console.error('Token exchange failed:', tokenData)
        return new Response('Failed to obtain access token', { status: 400 })
      }

      // Get shop information
      const shopInfoResponse = await fetch(`https://${shop}/admin/api/2025-07/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': tokenData.access_token,
          'Content-Type': 'application/json',
        },
      })

      const shopInfo = await shopInfoResponse.json()
      console.log('Shop info received:', shopInfo)

      // Store shop credentials
      const { data: shopData, error: shopError } = await supabaseClient
        .from('shops')
        .upsert({
          shop_domain: shop,
          access_token: tokenData.access_token,
          shop_name: shopInfo.shop?.name,
          email: shopInfo.shop?.email,
        }, {
          onConflict: 'shop_domain'
        })

      if (shopError) {
        console.error('Failed to save shop:', shopError)
        return new Response('Failed to save shop data', { status: 500 })
      }

      console.log('Shop saved successfully:', shopData)

      // Clean up state
      await supabaseClient
        .from('oauth_states')
        .delete()
        .eq('state', state)

      // Redirect back to the app - use the correct app URL
      const appUrl = `https://lovable.dev/projects/c2a12ba6-79bd-4b7c-bd47-e1c32e53c1bd?shop=${shop}&installed=true`
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': appUrl,
          ...corsHeaders
        }
      })
    }

    return new Response('Invalid action', { status: 400 })

  } catch (error) {
    console.error('OAuth error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})