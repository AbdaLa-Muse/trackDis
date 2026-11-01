import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, createSessionToken, jsonResponse, verifyAccessCode } from '../_shared/security.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors)

  try {
    const { code } = await req.json()
    if (!/^\d{4}$/.test(String(code || ''))) return jsonResponse({ error: 'Incorrect code' }, 401, cors)

    const url = Deno.env.get('SUPABASE_URL')!
    const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('TRADEFLOW_SUPABASE_SECRET_KEY')
    const salt = Deno.env.get('TRADEFLOW_ACCESS_SALT')
    const hash = Deno.env.get('TRADEFLOW_ACCESS_HASH')
    const sessionSecret = Deno.env.get('TRADEFLOW_SESSION_SECRET')
    if (!adminKey || !salt || !hash || !sessionSecret) return jsonResponse({ error: 'Server is not configured' }, 500, cors)

    const admin = createClient(url, adminKey, { auth: { persistSession: false } })
    const { data: settings, error: settingsError } = await admin
      .from('user_settings')
      .select('failed_attempts, lock_until')
      .eq('id', 1)
      .single()
    if (settingsError) return jsonResponse({ error: 'Could not verify access' }, 500, cors)

    const now = new Date()
    if (settings.lock_until && new Date(settings.lock_until) > now) {
      return jsonResponse({ error: 'Too many attempts. Try again later.', locked: true }, 429, cors)
    }

    const ok = await verifyAccessCode(String(code), salt, hash)
    if (!ok) {
      const nextAttempts = Number(settings.failed_attempts || 0) + 1
      const shouldLock = nextAttempts >= 5
      const lockUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
      await admin.from('user_settings').update({
        failed_attempts: shouldLock ? 0 : nextAttempts,
        lock_until: lockUntil,
      }).eq('id', 1)
      return jsonResponse({ error: shouldLock ? 'Too many attempts. Try again later.' : 'Incorrect code', locked: shouldLock }, shouldLock ? 429 : 401, cors)
    }

    await admin.from('user_settings').update({ failed_attempts: 0, lock_until: null }).eq('id', 1)
    const token = await createSessionToken(sessionSecret, 8)
    return jsonResponse({ ok: true, token, expiresInSeconds: 8 * 3600 }, 200, cors)
  } catch {
    return jsonResponse({ error: 'Could not verify access' }, 500, cors)
  }
})
