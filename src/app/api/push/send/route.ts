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
    console.error('[push/send] JSON inválido no corpo da requisição')
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { agendamentoId } = body as { agendamentoId?: string }
  console.log('[push/send] recebido agendamentoId =', agendamentoId)

  if (!agendamentoId) {
    console.error('[push/send] agendamentoId ausente no corpo da requisição')
    return NextResponse.json({ error: 'agendamentoId é obrigatório' }, { status: 400 })
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error(
      '[push/send] VAPID keys não configuradas no ambiente — ' +
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY ${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'presente' : 'AUSENTE'}, ` +
      `VAPID_PRIVATE_KEY ${process.env.VAPID_PRIVATE_KEY ? 'presente' : 'AUSENTE'}`
    )
    return NextResponse.json({ error: 'Push não configurado' }, { status: 500 })
  }

  const { data: agendamento, error: agendamentoError } = await supabaseAdmin
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
    } | null, error: { message: string } | null }

  if (!agendamento) {
    console.error('[push/send] agendamento não encontrado:', agendamentoId, agendamentoError?.message)
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  }

  console.log('[push/send] agendamento encontrado — prestadora_id =', agendamento.prestadora_id, 'status =', agendamento.status)

  const { data: subscriptionsRaw, error: subscriptionsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_agent, created_at')
    .eq('prestadora_id', agendamento.prestadora_id) as { data: {
      id: string
      endpoint: string
      p256dh: string
      auth: string
      user_agent: string | null
      created_at: string
    }[] | null, error: { message: string } | null }

  if (subscriptionsError) {
    console.error('[push/send] erro ao buscar push_subscriptions:', subscriptionsError.message)
    return NextResponse.json({ error: subscriptionsError.message }, { status: 500 })
  }

  console.log(`[push/send] ${subscriptionsRaw?.length ?? 0} subscription(s) encontrada(s) para prestadora ${agendamento.prestadora_id}`)

  if (!subscriptionsRaw?.length) {
    console.warn('[push/send] nenhuma subscription registrada — notificação não será enviada a nenhum dispositivo')
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // O token do FCM/push rotaciona periodicamente, então o mesmo celular pode
  // acumular várias inscrições com endpoints diferentes ao longo do tempo —
  // sem deduplicar por dispositivo, cada uma recebe a notificação e o mesmo
  // celular vê duplicatas. Mantém só a mais recente por user_agent e remove
  // as obsoletas.
  const porDispositivo = new Map<string, typeof subscriptionsRaw>()
  const semDispositivoIdentificado: typeof subscriptionsRaw = []
  for (const sub of subscriptionsRaw) {
    if (!sub.user_agent) {
      semDispositivoIdentificado.push(sub)
      continue
    }
    const grupo = porDispositivo.get(sub.user_agent) ?? []
    grupo.push(sub)
    porDispositivo.set(sub.user_agent, grupo)
  }

  const subscriptions = [...semDispositivoIdentificado]
  const subscriptionsObsoletas: typeof subscriptionsRaw = []
  for (const grupo of porDispositivo.values()) {
    const ordenado = [...grupo].sort((a, b) => b.created_at.localeCompare(a.created_at))
    subscriptions.push(ordenado[0])
    subscriptionsObsoletas.push(...ordenado.slice(1))
  }

  if (subscriptionsObsoletas.length) {
    console.log(
      `[push/send] removendo ${subscriptionsObsoletas.length} subscription(s) duplicada(s) do mesmo dispositivo:`,
      subscriptionsObsoletas.map((s) => s.id)
    )
    await supabaseAdmin.from('push_subscriptions').delete().in('id', subscriptionsObsoletas.map((s) => s.id))
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

  results.forEach((r, i) => {
    const endpointHost = (() => {
      try { return new URL(subscriptions[i].endpoint).host } catch { return subscriptions[i].endpoint }
    })()
    if (r.status === 'fulfilled') {
      console.log(`[push/send] enviado com sucesso -> ${endpointHost} (subscription ${subscriptions[i].id})`)
    } else {
      const reason = r.reason as { statusCode?: number; body?: string; message?: string }
      console.error(
        `[push/send] falha ao enviar -> ${endpointHost} (subscription ${subscriptions[i].id}): ` +
        `status=${reason?.statusCode ?? '?'} body=${reason?.body ?? reason?.message ?? 'sem detalhes'}`
      )
    }
  })

  const expiredIds = subscriptions
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
    })
    .map((sub) => sub.id)

  if (expiredIds.length) {
    console.log(`[push/send] removendo ${expiredIds.length} subscription(s) expirada(s)/inválida(s):`, expiredIds)
    await supabaseAdmin.from('push_subscriptions').delete().in('id', expiredIds)
  }

  const sentCount = results.filter((r) => r.status === 'fulfilled').length
  console.log(`[push/send] concluído — ${sentCount}/${subscriptions.length} enviado(s) com sucesso`)

  return NextResponse.json({ ok: true, sent: sentCount })
}
