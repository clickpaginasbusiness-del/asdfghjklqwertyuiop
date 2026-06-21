import crypto from 'crypto'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const TEN_MINUTES_MS = 10 * 60 * 1000

type SessionTokenPayload = {
  kind: 'sessao'
  clienteId: string
  telefone: string
  exp: number
}

type VerificationTokenPayload = {
  kind: 'verificacao'
  telefone: string
  finalidade: 'cadastro' | 'recuperacao'
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

function encode(payload: unknown): string {
  const payloadEncoded = base64url(JSON.stringify(payload))
  const signature = sign(payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

function decode<T extends { exp: number }>(token: string | null | undefined): T | null {
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

  let payload: T
  try {
    payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null

  return payload
}

export function signClientToken({ clienteId, telefone }: { clienteId: string; telefone: string }): string {
  const payload: SessionTokenPayload = { kind: 'sessao', clienteId, telefone, exp: Date.now() + THIRTY_DAYS_MS }
  return encode(payload)
}

export function verifyClientToken(token: string | null | undefined): { clienteId: string; telefone: string } | null {
  const payload = decode<SessionTokenPayload>(token)
  if (!payload || payload.kind !== 'sessao' || !payload.clienteId || !payload.telefone) return null
  return { clienteId: payload.clienteId, telefone: payload.telefone }
}

export function signVerificationToken(
  { telefone, finalidade }: { telefone: string; finalidade: 'cadastro' | 'recuperacao' }
): string {
  const payload: VerificationTokenPayload = { kind: 'verificacao', telefone, finalidade, exp: Date.now() + TEN_MINUTES_MS }
  return encode(payload)
}

export function verifyVerificationToken(
  token: string | null | undefined
): { telefone: string; finalidade: 'cadastro' | 'recuperacao' } | null {
  const payload = decode<VerificationTokenPayload>(token)
  if (!payload || payload.kind !== 'verificacao' || !payload.telefone || !payload.finalidade) return null
  return { telefone: payload.telefone, finalidade: payload.finalidade }
}
