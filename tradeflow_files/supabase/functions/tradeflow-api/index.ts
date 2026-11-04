import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, verifySessionToken } from '../_shared/security.ts'

const validDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const validRisk = (v: unknown) => v === 'followed' || v === 'broke' || v === null
const validResult = (v: unknown) => v === 'win' || v === 'loss' || v === 'no_trade'

function normalizeReview(input: any, allowUnrecorded = false) {
  if (!input || !validDate(input.date) || (!validResult(input.result) && !(allowUnrecorded && input.result == null))) return null
  let risk = input.risk ?? null
  let strategy = input.strategy ?? null
  if (input.result === 'no_trade') { risk = null; strategy = null }
  if (!validRisk(risk) || !validRisk(strategy)) return null
  if (input.result !== 'no_trade' && (risk === null || strategy === null)) return null
  return { date: input.date, risk, strategy, result: input.result ?? null }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors)

  const sessionSecret = Deno.env.get('TRADEFLOW_SESSION_SECRET')
  const token = req.headers.get('x-tradeflow-session')
  if (!sessionSecret || !(await verifySessionToken(token, sessionSecret))) {
    return jsonResponse({ error: 'Session expired or invalid', code: 'SESSION_INVALID' }, 401, cors)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('TRADEFLOW_SUPABASE_SECRET_KEY')
  if (!adminKey) return jsonResponse({ error: 'Server is not configured' }, 500, cors)
  const admin = createClient(url, adminKey, { auth: { persistSession: false } })

  try {
    const body = await req.json()
    const action = body?.action

    if (action === 'bootstrap') {
      const [{ data: reviews, error: re }, { data: settings, error: se }] = await Promise.all([
        admin.from('daily_reviews').select('id,date,risk,strategy,result,created_at,updated_at').order('date', { ascending: false }),
        admin.from('user_settings').select('official_start_date,theme,created_at,updated_at').eq('id', 1).single(),
      ])
      if (re || se) return jsonResponse({ error: 'Could not load TradeFlow data' }, 500, cors)
      return jsonResponse({ reviews: reviews || [], settings }, 200, cors)
    }

    if (action === 'upsert_review') {
      const review = normalizeReview(body.review)
      if (!review) return jsonResponse({ error: 'Invalid review data' }, 400, cors)
      const { data, error } = await admin.from('daily_reviews').upsert(review, { onConflict: 'date' }).select().single()
      if (error) return jsonResponse({ error: 'Could not save review' }, 500, cors)
      return jsonResponse({ review: data }, 200, cors)
    }

    if (action === 'delete_review') {
      if (!validDate(body.date)) return jsonResponse({ error: 'Invalid date' }, 400, cors)
      const { error } = await admin.from('daily_reviews').delete().eq('date', body.date)
      if (error) return jsonResponse({ error: 'Could not delete review' }, 500, cors)
      return jsonResponse({ ok: true }, 200, cors)
    }

    if (action === 'set_theme') {
      if (!['dark', 'light'].includes(body.theme)) return jsonResponse({ error: 'Invalid theme' }, 400, cors)
      const { data, error } = await admin.from('user_settings').update({ theme: body.theme }).eq('id', 1).select('official_start_date,theme').single()
      if (error) return jsonResponse({ error: 'Could not save theme' }, 500, cors)
      return jsonResponse({ settings: data }, 200, cors)
    }

    if (action === 'import_backup' || action === 'migrate_local') {
      const input = Array.isArray(body.reviews) ? body.reviews : []
      const reviews = input.map((r: any) => normalizeReview(r, true)).filter(Boolean)
      if (input.length && reviews.length !== input.length) return jsonResponse({ error: 'Backup contains invalid reviews' }, 400, cors)
      if (reviews.length) {
        const { error } = await admin.from('daily_reviews').upsert(reviews, { onConflict: 'date' })
        if (error) return jsonResponse({ error: 'Could not import reviews' }, 500, cors)
      }
      const updates: Record<string, unknown> = {}
      if (['dark','light'].includes(body.theme)) updates.theme = body.theme
      // Official Start Date is intentionally locked to 2026-10-22 for this TradeFlow account.
      if (Object.keys(updates).length) await admin.from('user_settings').update(updates).eq('id', 1)
      return jsonResponse({ ok: true, imported: reviews.length }, 200, cors)
    }

    return jsonResponse({ error: 'Unknown action' }, 400, cors)
  } catch {
    return jsonResponse({ error: 'TradeFlow request failed' }, 500, cors)
  }
})
