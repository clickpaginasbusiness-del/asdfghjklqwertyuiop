import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// In-memory rate limiter (per Edge runtime instance — good enough for single-region deployments)
const ipWindows = new Map<string, { count: number; resetAt: number }>()

// Rotas sensíveis (login/cadastro/OTP) ficam num limite mais apertado que o
// resto da API, separado por bucket para não compartilhar contador com
// chamadas comuns do mesmo IP.
const SENSITIVE_PATH_PREFIXES = [
  '/api/auth/complete-signup',
  '/api/clientes/auth/login',
  '/api/clientes/auth/enviar-codigo',
  '/api/clientes/auth/verificar-codigo',
  '/api/clientes/auth/finalizar-cadastro',
  '/api/clientes/auth/redefinir-senha',
]

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

function isRateLimited(bucket: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = ipWindows.get(bucket)

  if (!entry || now > entry.resetAt) {
    ipWindows.set(bucket, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  return entry.count > limit
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    const ip = getIp(request)
    const sensivel = SENSITIVE_PATH_PREFIXES.some((p) => pathname.startsWith(p))
    // Rotas sensíveis: 10 requisições/minuto por IP. Demais rotas de API: 20/minuto.
    const limited = sensivel
      ? isRateLimited(`${ip}:sensivel`, 10, 60_000)
      : isRateLimited(`${ip}:geral`, 20, 60_000)

    if (limited) {
      return new NextResponse(
        JSON.stringify({ error: 'Muitas requisições. Tente novamente em breve.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
