const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  })
}

export function corsHeaders(req: Request) {
  const configured = Deno.env.get('TRADEFLOW_ALLOWED_ORIGIN')?.trim()
  const origin = req.headers.get('origin') || ''
  const allowOrigin = configured && configured !== '*' ? (origin === configured ? origin : configured) : '*'
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-tradeflow-session',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'Origin',
  }
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((b) => binary += String.fromCharCode(b))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function hmac(data: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

export async function createSessionToken(secret: string, hours = 8) {
  const now = Math.floor(Date.now() / 1000)
  const payload = { v: 1, scope: 'tradeflow', iat: now, exp: now + Math.max(1, hours) * 3600 }
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const sig = toBase64Url(await hmac(encoded, secret))
  return `${encoded}.${sig}`
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifySessionToken(token: string | null, secret: string) {
  if (!token || !token.includes('.')) return false
  try {
    const [encoded, supplied] = token.split('.')
    const expected = await hmac(encoded, secret)
    if (!constantTimeEqual(expected, fromBase64Url(supplied))) return false
    const payload = JSON.parse(decoder.decode(fromBase64Url(encoded)))
    const now = Math.floor(Date.now() / 1000)
    return payload?.scope === 'tradeflow' && payload?.v === 1 && Number(payload?.exp) > now
  } catch {
    return false
  }
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) throw new Error('Invalid hex')
  return Uint8Array.from(hex.match(/.{2}/g)!.map((x) => parseInt(x, 16)))
}

export async function verifyAccessCode(code: string, saltHex: string, expectedHashHex: string) {
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(code), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: 150_000 },
    baseKey,
    256,
  )
  return constantTimeEqual(new Uint8Array(bits), hexToBytes(expectedHashHex))
}
