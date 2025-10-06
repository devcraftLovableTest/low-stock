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
    const supabase = createClient(
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

    const { action, shopDomain } = requestBody as any
    
    console.log('Shopify API request:', { action, shopDomain })

    switch (action) {
      case 'fetch-products':
        return handleFetchProducts(supabase, requestBody, shopDomain);
      case 'get-inventory':
        return handleGetInventory(supabase, shopDomain);
      case 'update-threshold':
        return handleUpdateThreshold(supabase, requestBody, shopDomain);
      case 'update-prices':
        return handleUpdatePrices(supabase, requestBody, shopDomain);
      case 'bulk-update-prices':
        return handleBulkUpdatePrices(supabase, requestBody, shopDomain);
      case 'bulk-update-prices-calculated':
        return handleBulkUpdatePricesCalculated(supabase, requestBody, shopDomain);
      case 'revert-bulk-action':
        return handleRevertBulkAction(supabase, requestBody, shopDomain);
      case 'fetch-collections':
        return handleFetchCollections(supabase, requestBody, shopDomain);
      case 'fetch-collection-products':
        return handleFetchCollectionProducts(supabase, requestBody, shopDomain);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleFetchProducts(supabase: any, requestBody: any, shopDomain: string) {
  if (!shopDomain) {
    return new Response(
      JSON.stringify({ error: 'Missing shopDomain' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get shop access token from DB
  console.log('Fetching access token from database for shop:', shopDomain)
  const { data: shopRow, error: shopErr } = await supabase
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

  const token = shopRow.access_token
  const shopId = shopRow.id

  // Verify required scopes
  try {
    const scopesResp = await fetch(`https://${shopDomain}/admin/oauth/access_scopes.json`, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    })
    if (scopesResp.ok) {
      const scopesJson = await scopesResp.json()
      const granted: string[] = (scopesJson?.access_scopes || []).map((s: any) => s.handle)
      const required = ['read_products','read_inventory']
      const missing = required.filter(s => !granted.includes(s))
      if (missing.length) {
        return new Response(
          JSON.stringify({ error: `Missing required scopes: ${missing.join(', ')}`, granted }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
  } catch (e) {
    console.warn('Error checking access scopes:', (e as any)?.message || e)
  }

  // Fetch products via GraphQL
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
                  price
                  compareAtPrice
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
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: gqlQuery, variables: { first: 100, variantsFirst: 100 } })
  })

  if (!shopifyResponse.ok) {
    const errorText = await shopifyResponse.text()
    console.error('Shopify API error:', errorText)
    return new Response(
      JSON.stringify({ error: `Shopify API error: ${shopifyResponse.status}` }),
      { status: shopifyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const gql = await shopifyResponse.json()
  
  if (gql.errors) {
    console.error('Shopify GraphQL errors:', gql.errors)
    return new Response(
      JSON.stringify({ error: `GraphQL errors: ${gql.errors.map((e: any) => e.message).join(', ')}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const edges = gql.data?.products?.edges || []

  // Helper to extract numeric id from GID
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
      const priceAmount = variant.price ? parseFloat(variant.price) : null
      const compareAmount = variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null
      const invQty = typeof variant.inventoryQuantity === 'number' ? variant.inventoryQuantity : 0

      await supabase
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
    }
  }

  return new Response(
    JSON.stringify({ products: edges.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetInventory(supabase: any, shopDomain: string) {
  const { data, error } = await supabase
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

async function handleUpdateThreshold(supabase: any, requestBody: any, shopDomain: string) {
  const { itemId, threshold } = requestBody
  
  const { error } = await supabase
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

async function handleUpdatePrices(supabase: any, requestBody: any, shopDomain: string) {
  const { itemId, price, compareAtPrice } = requestBody

  // Get inventory item
  const { data: itemRow, error: itemErr } = await supabase
    .from('inventory_items')
    .select('id, shopify_variant_id')
    .eq('id', itemId)
    .eq('shop_domain', shopDomain)
    .maybeSingle()

  if (itemErr || !itemRow?.shopify_variant_id) {
    return new Response(
      JSON.stringify({ error: 'Inventory item not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get shop access token
  const { data: shopRow, error: shopErr } = await supabase
    .from('shops')
    .select('access_token')
    .eq('shop_domain', shopDomain)
    .maybeSingle()

  if (shopErr || !shopRow?.access_token) {
    return new Response(
      JSON.stringify({ error: 'Missing access token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const token = shopRow.access_token

  // Update Shopify variant
  if (itemRow.shopify_variant_id && (price || compareAtPrice)) {
    const mutation = `
      mutation productVariantUpdate($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant {
            id
            price
            compareAtPrice
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: `gid://shopify/ProductVariant/${itemRow.shopify_variant_id}`,
        ...(price && { price: price }),
        ...(compareAtPrice && { compareAtPrice: compareAtPrice })
      }
    };

    await fetch(`https://${shopDomain}/admin/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });
  }

  // Update local database
  const updateData: any = {};
  if (price) updateData.price = parseFloat(price);
  if (compareAtPrice) updateData.compare_at_price = parseFloat(compareAtPrice);

  if (Object.keys(updateData).length > 0) {
    await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', itemId);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleBulkUpdatePrices(supabase: any, requestBody: any, shopDomain: string) {
  const { productIds, price, compareAtPrice, actionName } = requestBody

  if (!productIds || productIds.length === 0 || !actionName) {
    return new Response(
      JSON.stringify({ error: 'Product IDs and action name are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get shop access token
  const { data: shopData } = await supabase
    .from('shops')
    .select('access_token')
    .eq('shop_domain', shopDomain)
    .single();

  if (!shopData) {
    return new Response(
      JSON.stringify({ error: 'Shop not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create bulk action record
  const { data: bulkAction, error: bulkActionError } = await supabase
    .from('bulk_actions')
    .insert({
      shop_domain: shopDomain,
      action_name: actionName,
      new_price: price ? parseFloat(price) : null,
      new_compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null,
      product_count: productIds.length
    })
    .select()
    .single();

  if (bulkActionError) {
    console.error('Error creating bulk action:', bulkActionError);
    return new Response(
      JSON.stringify({ error: 'Failed to create bulk action' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get products with their current prices
  const { data: products } = await supabase
    .from('inventory_items')
    .select('*')
    .in('id', productIds)
    .eq('shop_domain', shopDomain);

  if (!products) {
    return new Response(
      JSON.stringify({ error: 'Products not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update each product
  const updatePromises = products.map(async (product: any) => {
    // Save original prices in bulk_action_items
    await supabase
      .from('bulk_action_items')
      .insert({
        bulk_action_id: bulkAction.id,
        inventory_item_id: product.id,
        original_price: product.price,
        original_compare_at_price: product.compare_at_price,
        new_price: price ? parseFloat(price) : product.price,
        new_compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : product.compare_at_price
      });

    // Update Shopify if we have variant ID
    if (product.shopify_variant_id && (price || compareAtPrice)) {
      const mutation = `
        mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
              price
              compareAtPrice
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          id: `gid://shopify/ProductVariant/${product.shopify_variant_id}`,
          ...(price && { price: price }),
          ...(compareAtPrice && { compareAtPrice: compareAtPrice })
        }
      };

      await fetch(`https://${shopDomain}/admin/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopData.access_token,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });
    }

    // Update local database
    const updateData: any = {};
    if (price) updateData.price = parseFloat(price);
    if (compareAtPrice) updateData.compare_at_price = parseFloat(compareAtPrice);

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', product.id);
    }
  });

  await Promise.all(updatePromises);

  return new Response(
    JSON.stringify({ success: true, bulkActionId: bulkAction.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleBulkUpdatePricesCalculated(supabase: any, requestBody: any, shopDomain: string) {
  const { priceUpdates, actionName } = requestBody

  if (!priceUpdates || priceUpdates.length === 0 || !actionName) {
    return new Response(
      JSON.stringify({ error: 'Price updates and action name are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get shop access token
  const { data: shopData } = await supabase
    .from('shops')
    .select('access_token')
    .eq('shop_domain', shopDomain)
    .single();

  if (!shopData) {
    return new Response(
      JSON.stringify({ error: 'Shop not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create bulk action record
  const { data: bulkAction, error: bulkActionError } = await supabase
    .from('bulk_actions')
    .insert({
      shop_domain: shopDomain,
      action_name: actionName,
      new_price: null, // Calculated prices vary per product
      new_compare_at_price: null,
      product_count: priceUpdates.length
    })
    .select()
    .single();

  if (bulkActionError) {
    console.error('Error creating bulk action:', bulkActionError);
    return new Response(
      JSON.stringify({ error: 'Failed to create bulk action' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get products with their current prices
  const productIds = priceUpdates.map((u: any) => u.productId);
  const { data: products } = await supabase
    .from('inventory_items')
    .select('*')
    .in('id', productIds)
    .eq('shop_domain', shopDomain);

  if (!products) {
    return new Response(
      JSON.stringify({ error: 'Products not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update each product with calculated prices
  const updatePromises = priceUpdates.map(async (update: any) => {
    const product = products.find((p: any) => p.id === update.productId);
    if (!product) return;

    const newPrice = update.newPrice;
    const newComparePrice = update.newComparePrice;

    // Save original prices in bulk_action_items
    await supabase
      .from('bulk_action_items')
      .insert({
        bulk_action_id: bulkAction.id,
        inventory_item_id: product.id,
        original_price: product.price,
        original_compare_at_price: product.compare_at_price,
        new_price: newPrice,
        new_compare_at_price: newComparePrice
      });

    // Update Shopify if we have variant ID
    if (product.shopify_variant_id && (newPrice !== null || newComparePrice !== null)) {
      const mutation = `
        mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
              price
              compareAtPrice
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          id: `gid://shopify/ProductVariant/${product.shopify_variant_id}`,
          ...(newPrice !== null && { price: newPrice.toString() }),
          ...(newComparePrice !== null && { compareAtPrice: newComparePrice.toString() })
        }
      };

      await fetch(`https://${shopDomain}/admin/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopData.access_token,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });
    }

    // Update local database
    const updateData: any = {};
    if (newPrice !== null) updateData.price = newPrice;
    if (newComparePrice !== null) updateData.compare_at_price = newComparePrice;

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', product.id);
    }
  });

  await Promise.all(updatePromises);

  return new Response(
    JSON.stringify({ success: true, bulkActionId: bulkAction.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRevertBulkAction(supabase: any, requestBody: any, shopDomain: string) {
  const { bulkActionId } = requestBody

  if (!bulkActionId) {
    return new Response(
      JSON.stringify({ error: 'Bulk action ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get shop access token
  const { data: shopData } = await supabase
    .from('shops')
    .select('access_token')
    .eq('shop_domain', shopDomain)
    .single();

  if (!shopData) {
    return new Response(
      JSON.stringify({ error: 'Shop not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get bulk action items
  const { data: actionItems } = await supabase
    .from('bulk_action_items')
    .select(`
      *,
      inventory_items!inner(shopify_variant_id)
    `)
    .eq('bulk_action_id', bulkActionId);

  if (!actionItems || actionItems.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Bulk action items not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Revert each product
  const revertPromises = actionItems.map(async (item: any) => {
    // Revert Shopify if we have variant ID
    if (item.inventory_items.shopify_variant_id) {
      const mutation = `
        mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
              price
              compareAtPrice
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          id: `gid://shopify/ProductVariant/${item.inventory_items.shopify_variant_id}`,
          price: item.original_price?.toString() || "0",
          compareAtPrice: item.original_compare_at_price?.toString() || null
        }
      };

      await fetch(`https://${shopDomain}/admin/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopData.access_token,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });
    }

    // Revert local database
    await supabase
      .from('inventory_items')
      .update({
        price: item.original_price,
        compare_at_price: item.original_compare_at_price
      })
      .eq('id', item.inventory_item_id);
  });

  await Promise.all(revertPromises);

  // Mark bulk action as reverted
  await supabase
    .from('bulk_actions')
    .update({ reverted_at: new Date().toISOString() })
    .eq('id', bulkActionId);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleFetchCollections(supabase: any, requestBody: any, shopDomain: string) {
  if (!shopDomain) {
    return new Response(
      JSON.stringify({ error: 'Missing shopDomain' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get shop access token from DB
  const { data: shopRow, error: shopErr } = await supabase
    .from('shops')
    .select('access_token')
    .eq('shop_domain', shopDomain)
    .maybeSingle();

  if (shopErr || !shopRow) {
    return new Response(
      JSON.stringify({ error: 'Shop not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = shopRow.access_token;

  const collectionsQuery = `
    query {
      collections(first: 250) {
        edges {
          node {
            id
            title
            handle
            productsCount
          }
        }
      }
    }
  `;
  
  const collectionsResponse = await fetch(`https://${shopDomain}/admin/api/2023-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: collectionsQuery }),
  });
  
  if (!collectionsResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch collections from Shopify' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const collectionsData = await collectionsResponse.json();
  
  return new Response(JSON.stringify({
    collections: collectionsData.data?.collections?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      products_count: edge.node.productsCount
    })) || []
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleFetchCollectionProducts(supabase: any, requestBody: any, shopDomain: string) {
  const { collectionId } = requestBody;

  if (!shopDomain || !collectionId) {
    return new Response(
      JSON.stringify({ error: 'Missing shopDomain or collectionId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get shop access token from DB
  const { data: shopRow, error: shopErr } = await supabase
    .from('shops')
    .select('access_token')
    .eq('shop_domain', shopDomain)
    .maybeSingle();

  if (shopErr || !shopRow) {
    return new Response(
      JSON.stringify({ error: 'Shop not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = shopRow.access_token;

  const collectionProductsQuery = `
    query {
      collection(id: "${collectionId}") {
        products(first: 250) {
          edges {
            node {
              id
              variants(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const collectionProductsResponse = await fetch(`https://${shopDomain}/admin/api/2023-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: collectionProductsQuery }),
  });
  
  if (!collectionProductsResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch collection products from Shopify' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const collectionProductsData = await collectionProductsResponse.json();
  
  // Get the inventory item IDs from our database for these products
  const shopifyProductIds = collectionProductsData.data?.collection?.products?.edges?.map((edge: any) => 
    edge.node.id.replace('gid://shopify/Product/', '')
  ) || [];
  
  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('shop_domain', shopDomain)
    .in('shopify_product_id', shopifyProductIds);
  
  return new Response(JSON.stringify({
    products: inventoryItems || []
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}