import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signClientToken } from '@/lib/clientAuth'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const slug = searchParams.get('slug') ?? ''

  if (!code || !slug) {
    return NextResponse.redirect(`${origin}/`)
  }

  const cookieStore = await cookies()
  const pendingCookies = new Map<string, { value: string; options: Parameters<typeof cookieStore.set>[2] }>()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
            pendingCookies.set(name, { value, options })
          })
        },
      },
    }
  )

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !session?.user?.email) {
    console.error('[clientes/google/callback] falha ao trocar code por sessão:', error?.message)
    return NextResponse.redirect(`${origin}/n/${slug}?google_error=1`)
  }

  const email = session.user.email
  const nomeGoogle = (
    (session.user.user_metadata?.full_name as string | undefined) ||
    (session.user.user_metadata?.name as string | undefined) ||
    ''
  ).trim()

  // Clientes usam tokens HMAC próprios — a sessão Supabase do OAuth não é necessária.
  await supabase.auth.signOut()

  const admin = createAdminClient()
  const { data: cliente, error: lookupError } = await admin
    .from('clientes')
    .select('id, nome, telefone')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    console.error('[clientes/google/callback] erro ao buscar cliente por email:', lookupError.message)
  }

  const baseRedirect = `${origin}/n/${slug}`

  const applySessionCookies = (res: NextResponse) => {
    pendingCookies.forEach(({ value, options }, name) => res.cookies.set(name, value, options))
    return res
  }

  if (cliente) {
    const token = signClientToken({ clienteId: cliente.id, telefone: cliente.telefone })
    return applySessionCookies(
      NextResponse.redirect(`${baseRedirect}?ct=${encodeURIComponent(token)}`)
    )
  }

  return applySessionCookies(
    NextResponse.redirect(
      `${baseRedirect}?ge=${encodeURIComponent(email)}&gn=${encodeURIComponent(nomeGoogle)}`
    )
  )
}
