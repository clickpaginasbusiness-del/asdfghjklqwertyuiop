import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { format } from 'date-fns'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contato@bellebook.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { agendamentoId } = body as { agendamentoId?: string }
  if (!agendamentoId) {
    return NextResponse.json({ error: 'agendamentoId é obrigatório' }, { status: 400 })
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Push não configurado' }, { status: 500 })
  }

  const { data: agendamento } = await supabaseAdmin
    .from('agendamentos')
    .select('id, data_hora, status, prestadora_id, servicos(nome), clientes(nome), profissionais(nome)')
    .eq('id', agendamentoId)
    .single() as { data: {
      id: string
      data_hora: string
      status: string
      prestadora_id: string
      servicos: { nome: string } | null
      clientes: { nome: string } | null
      profissionais: { nome: string } | null
    } | null }

  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  }

  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('prestadora_id', agendamento.prestadora_id)

  if (!subscriptions?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const { servicos: servico, clientes: cliente, profissionais: profissional } = agendamento

  const profNome = profissional?.nome ? ` com ${profissional.nome}` : ''
  const dataFormatada = format(new Date(agendamento.data_hora), "dd/MM 'às' HH'h'mm")
  const isCancelamento = agendamento.status === 'cancelado'

  const payload = JSON.stringify({
    title: isCancelamento ? 'Agendamento cancelado' : 'Novo agendamento!',
    body: isCancelamento
      ? `${cliente?.nome} cancelou ${servico?.nome}${profNome} em ${dataFormatada}`
      : `${cliente?.nome} agendou ${servico?.nome}${profNome} para ${dataFormatada}`,
    url: '/painel/agendamentos',
  })

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  const expiredIds = subscriptions
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
    })
    .map((sub) => sub.id)

  if (expiredIds.length) {
    await supabaseAdmin.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return NextResponse.json({ ok: true, sent: results.filter((r) => r.status === 'fulfilled').length })
}
