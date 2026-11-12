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

    // Verify the calling user's identity via their JWT
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
    const { match_id } = body

    if (!match_id) {
      return json({ error: 'MISSING_MATCH_ID' }, 400)
    }

    // Service role client — bypasses RLS, can call SECURITY DEFINER functions
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await serviceClient.rpc('unlock_match_atomic', {
      p_match_id: match_id,
      p_payer_id: user.id,
    })

    if (error) {
      console.error('unlock_match_atomic error:', error)
      return json({ error: 'INTERNAL_ERROR', detail: error.message }, 500)
    }

    const result = data?.[0]
    if (!result) {
      return json({ error: 'INTERNAL_ERROR' }, 500)
    }

    if (!result.success) {
      const statusMap: Record<string, number> = {
        INSUFFICIENT_BALANCE:   402,
        NOT_MATCH_PARTICIPANT:  403,
        MATCH_NOT_FOUND:        404,
        ALREADY_UNLOCKED:       200,
      }
      return json({
        success:       result.success,
        error_code:    result.error_code,
        payer_balance: result.payer_balance,
      }, statusMap[result.error_code] ?? 400)
    }

    return json({
      success:         true,
      payer_balance:   result.payer_balance,
      partner_balance: result.partner_balance,
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
