import { NextRequest, NextResponse } from 'next/server'
import { checarCodigoVerificacao } from '@/lib/twilioVerify'
import { cleanTelefone, toE164 } from '@/lib/utils'
import { signVerificationToken } from '@/lib/clientAuth'

export async function POST(request: NextRequest) {
  let body: { telefone?: string; codigo?: string; finalidade?: 'cadastro' | 'recuperacao' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const digits = cleanTelefone(body.telefone ?? '')
  const codigo = (body.codigo ?? '').trim()
  const finalidade = body.finalidade
  if (digits.length < 10 || digits.length > 11 || codigo.length < 4) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }
  if (finalidade !== 'cadastro' && finalidade !== 'recuperacao') {
    return NextResponse.json({ error: 'Finalidade inválida' }, { status: 400 })
  }

  const aprovado = await checarCodigoVerificacao(toE164(digits), codigo)
  if (!aprovado) {
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 })
  }

  const verificationToken = signVerificationToken({ telefone: digits, finalidade })

  return NextResponse.json({ verificationToken })
}
