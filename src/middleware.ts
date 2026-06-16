import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// In-memory rate limiter (per Edge runtime instance — good enough for single-region deployments)
const ipWindows = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

function isRateLimited(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const key = `${ip}:${windowMs}`
  const entry = ipWindows.get(key)

  if (!entry || now > entry.resetAt) {
    ipWindows.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  return entry.count > limit
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate-limit public API routes: 20 requests/minute per IP
  if (pathname.startsWith('/api/')) {
    const ip = getIp(request)
    if (isRateLimited(ip, 20, 60_000)) {
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
