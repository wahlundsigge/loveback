import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const [profileResult, transactionsResult] = await Promise.all([
      serviceClient
        .from('profiles')
        .select('coin_balance')
        .eq('id', user.id)
        .single(),
      serviceClient
        .from('coin_transactions')
        .select('id, amount, balance_after, type, ref_id, ref_type, description, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (profileResult.error) {
      return json({ error: 'PROFILE_NOT_FOUND' }, 404)
    }

    const transactions = transactionsResult.data ?? []

    return json({
      coin_balance:     profileResult.data.coin_balance,
      transactions,
      purchase_history: transactions.filter((t) => t.type === 'purchase'),
      reward_history:   transactions.filter((t) => t.type === 'reward'),
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
