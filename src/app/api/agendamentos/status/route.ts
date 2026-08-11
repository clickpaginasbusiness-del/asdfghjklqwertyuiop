import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Endpoint mínimo pra /agendamento/sucesso fazer polling do status de um
 * agendamento (aguardando_pagamento -> confirmado) direto do navegador via
 * fetch, sem depender de router.refresh()/re-render de Server Component —
 * evita qualquer ambiguidade de cache/RSC e deixa o fluxo 100% observável
 * via devtools (Network). Não precisa de auth: mesmo modelo de confiança já
 * usado pela própria página (busca só pelo id, sem validar dono).
 */
export async function GET(request: NextRequest) {
  const agendamentoId = request.nextUrl.searchParams.get('agendamentoId')
  if (!agendamentoId) {
    return NextResponse.json({ error: 'agendamentoId é obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: agendamento } = await admin
    .from('agendamentos')
    .select('status')
    .eq('id', agendamentoId)
    .maybeSingle()

  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  }

  return NextResponse.json(
    { status: agendamento.status },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
