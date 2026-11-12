import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// MOCK PURCHASE — no real payment processing yet.
// When Stripe is integrated:
//   1. Create a Stripe PaymentIntent for pkg.price_sek
//   2. Return client_secret to the app
//   3. App completes payment with Stripe React Native SDK
//   4. Stripe webhook calls a separate confirm-purchase Edge Function
//   5. confirm-purchase calls record_coin_purchase RPC
// The record_coin_purchase RPC uses the payment_intent_id as an idempotency key
// so Stripe webhook retries are safe.

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'UNAUTHORIZED' }, 401)
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return json({ error: 'UNAUTHORIZED' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const { package_id } = body

    if (!package_id) {
      return json({ error: 'MISSING_PACKAGE_ID' }, 400)
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate the package exists and is active
    const { data: pkg, error: pkgError } = await serviceClient
      .from('coin_packages')
      .select('id, coins, bonus_coins, label, price_sek')
      .eq('id', package_id)
      .eq('is_active', true)
      .single()

    if (pkgError || !pkg) {
      return json({ error: 'INVALID_PACKAGE' }, 400)
    }

    // Mock payment intent ID — replace with real Stripe PaymentIntent ID in production
    const mockPaymentIntentId = `mock_pi_${Date.now()}_${user.id.slice(0, 8)}`

    const { data: result, error: rpcError } = await serviceClient.rpc('record_coin_purchase', {
      p_user_id:              user.id,
      p_package_id:           package_id,
      p_payment_intent_id:    mockPaymentIntentId,
    })

    if (rpcError) {
      console.error('record_coin_purchase error:', rpcError)
      return json({ error: 'PURCHASE_FAILED', detail: rpcError.message }, 500)
    }

    const row = result?.[0]

    return json({
      success:     true,
      new_balance: row?.new_balance ?? 0,
      coins_added: pkg.coins + pkg.bonus_coins,
      package: {
        id:          pkg.id,
        label:       pkg.label,
        coins:       pkg.coins,
        bonus_coins: pkg.bonus_coins,
        price_sek:   pkg.price_sek,
      },
    }, 200)

  } catch (err) {
    console.error('Unexpected error:', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
