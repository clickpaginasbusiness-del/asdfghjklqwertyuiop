import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get('next') ?? '/painel'

  // token_hash flow (cross-device, sem PKCE verifier) — gerado pelo template de email
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // code flow (PKCE — requer verifier no mesmo browser que gerou o link)
  const code = searchParams.get('code')

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

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`)
      pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      return response
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`)
      pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      return response
    }
  }

  return NextResponse.redirect(`${origin}/painel/recuperar-senha?error=link-invalido`)
}
