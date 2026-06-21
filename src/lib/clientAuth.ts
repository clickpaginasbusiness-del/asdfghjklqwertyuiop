import crypto from 'crypto'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

type ClientTokenPayload = {
  clienteId: string
  telefone: string
  exp: number
}

function getSecret(): string {
  const secret = process.env.CLIENT_SESSION_SECRET
  if (!secret) throw new Error('CLIENT_SESSION_SECRET não configurado')
  return secret
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function signClientToken({ clienteId, telefone }: { clienteId: string; telefone: string }): string {
  const payload: ClientTokenPayload = { clienteId, telefone, exp: Date.now() + THIRTY_DAYS_MS }
  const payloadEncoded = base64url(JSON.stringify(payload))
  const signature = sign(payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

export function verifyClientToken(token: string | null | undefined): { clienteId: string; telefone: string } | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadEncoded, signature] = parts

  let expectedSig: string
  try {
    expectedSig = sign(payloadEncoded)
  } catch {
    return null
  }

  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let payload: ClientTokenPayload
  try {
    payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
  if (!payload.clienteId || !payload.telefone) return null

  return { clienteId: payload.clienteId, telefone: payload.telefone }
}
