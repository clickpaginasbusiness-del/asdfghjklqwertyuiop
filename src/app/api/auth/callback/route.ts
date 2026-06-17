import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/painel'

  console.log('[auth/callback] code:', code ? `${code.slice(0, 8)}…` : 'AUSENTE')
  console.log('[auth/callback] next:', next)
  console.log('[auth/callback] origin:', origin)
  console.log('[auth/callback] url completa:', request.url)

  if (code) {
    const cookieStore = await cookies()
    type PendingCookie = { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }
    const pendingCookies: PendingCookie[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              pendingCookies.push({ name, value, options })
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchangeCodeForSession error:', error ?? 'nenhum')
    console.log('[auth/callback] cookies gerados:', pendingCookies.map(c => c.name))

    if (!error) {
      const destino = `${origin}${next}`
      console.log('[auth/callback] redirecionando para:', destino)
      const response = NextResponse.redirect(destino)
      pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      return response
    }
  }

  console.log('[auth/callback] FALLBACK — redirecionando para recuperar-senha')
  return NextResponse.redirect(`${origin}/painel/recuperar-senha?error=link-invalido`)
}
