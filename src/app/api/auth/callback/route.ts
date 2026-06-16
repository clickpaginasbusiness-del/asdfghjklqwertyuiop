import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/painel'

  if (code) {
    const cookieStore = await cookies()
    // Collect cookies that exchangeCodeForSession wants to set so we can
    // copy them onto the redirect response — NextResponse.redirect() does
    // not automatically inherit cookies written via cookieStore.set().
    const pendingCookies: Array<Parameters<typeof cookieStore.set>> = []

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
              pendingCookies.push([name, value, options])
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`)
      pendingCookies.forEach(([name, value, options]) => response.cookies.set(name, value, options))
      return response
    }
  }

  return NextResponse.redirect(`${origin}/painel/recuperar-senha?error=link-invalido`)
}
