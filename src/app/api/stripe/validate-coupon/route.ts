import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { codigo } = await request.json()
  const code = (codigo ?? '').trim().toUpperCase()

  if (!code) {
    return NextResponse.json({ error: 'Informe o código do cupom' }, { status: 400 })
  }

  try {
    const coupon = await stripe.coupons.retrieve(code)
    if (!coupon.valid) {
      return NextResponse.json({ error: 'Cupom inválido ou expirado' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Cupom inválido ou expirado' }, { status: 400 })
  }
}
