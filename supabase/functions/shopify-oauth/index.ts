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
    const useraction = url.searchParams.get('useraction')

    if (useraction === 'prepare') {
      const shop = url.searchParams.get('shop')
      const returnUrl = url.searchParams.get('returnUrl') || ''
      
      if (!shop) {
        return new Response(JSON.stringify({ error: 'Missing shop parameter' }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const clientId = 'b211150c38f46b557626d779ea7a3bcf'
      const scopes = 'read_products,write_products,read_inventory,write_inventory'
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-oauth?useraction=callback`
      const state = crypto.randomUUID()

      // Store state and return URL for verification
      await supabaseClient
        .from('oauth_states')
        .insert({ 
          state, 
          shop_domain: shop, 
          return_url: returnUrl,
          created_at: new Date().toISOString() 
        })

      const authUrl = `https://${shop}/admin/oauth/authorize?` +
        `client_id=${clientId}&` +
        `scope=${scopes}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `access_mode=offline`

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle callback - check for both useraction=callback or missing useraction (Shopify redirect)
    if (useraction === 'callback' || (!useraction && url.searchParams.has('code'))) {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const shop = url.searchParams.get('shop')

      if (!code || !state || !shop) {
        console.error('Missing parameters:', { code: !!code, state: !!state, shop: !!shop })
        return new Response('Missing required parameters', { status: 400 })
      }

      console.log('Looking for state:', state, 'for shop:', shop)

      // Verify state and get return URL
      const { data: stateData, error: stateError } = await supabaseClient
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('shop_domain', shop)
        .single()

      console.log('State lookup result:', { stateData, stateError })

      if (!stateData || stateError) {
        console.error('State verification failed:', stateError)
        return new Response('Invalid state parameter', { status: 400 })
      }

      const returnUrl = stateData.return_url || `https://preview--low-stock.lovable.app/?shop=${shop}&installed=true`

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

      // Post-install: verify granted access scopes before proceeding
      try {
        const scopesResp = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
          headers: {
            'X-Shopify-Access-Token': tokenData.access_token,
            'Content-Type': 'application/json',
          },
        })

        if (scopesResp.ok) {
          const scopesJson = await scopesResp.json()
          const granted: string[] = (scopesJson?.access_scopes || []).map((s: any) => s.handle)
          console.log('Granted scopes after install:', granted)
          const required = ['read_products', 'read_inventory']
          const missing = required.filter((s) => !granted.includes(s))

          if (missing.length) {
            const msg = `Missing required scopes: ${missing.join(', ')}`
            console.error(msg)

            // Clean up state
            await supabaseClient
              .from('oauth_states')
              .delete()
              .eq('state', state)

            // Redirect back with clear error message
            try {
              const url = new URL(returnUrl)
              url.searchParams.set('installed', 'false')
              url.searchParams.set('error', 'missing_scopes')
              url.searchParams.set('message', msg)
              url.searchParams.set('docs', 'https://shopify.dev/api/usage/access-scopes')

              return new Response(null, {
                status: 302,
                headers: { 'Location': url.toString(), ...corsHeaders },
              })
            } catch (_) {
              return new Response(
                JSON.stringify({ error: 'missing_scopes', message: msg, granted }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
        } else {
          console.warn('Failed to fetch access scopes:', scopesResp.status, scopesResp.statusText)
        }
      } catch (e) {
        console.warn('Error checking access scopes:', (e as any)?.message || e)
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

      // Redirect back to the stored return URL
      return new Response(null, {
        status: 302,
        headers: {
          'Location': returnUrl,
          ...corsHeaders
        }
      })
    }

    return new Response('Invalid useraction', { status: 400 })

  } catch (error) {
    console.error('OAuth error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})