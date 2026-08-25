import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { getFcmMessaging } from '@/lib/firebaseAdmin'

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
  const internalSecret = process.env.INTERNAL_API_SECRET
  if (!internalSecret || request.headers.get('x-internal-secret') !== internalSecret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    console.error('[push/send] JSON inválido no corpo da requisição')
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { agendamentoId, planoAssinaturaId, tipo, valorPago } = body as {
    agendamentoId?: string
    planoAssinaturaId?: string
    tipo?: 'agendamento' | 'pagamento'
    valorPago?: number
  }
  console.log('[push/send] recebido agendamentoId =', agendamentoId, 'planoAssinaturaId =', planoAssinaturaId, 'tipo =', tipo ?? 'agendamento')

  if (!agendamentoId && !planoAssinaturaId) {
    console.error('[push/send] agendamentoId ou planoAssinaturaId é obrigatório')
    return NextResponse.json({ error: 'agendamentoId ou planoAssinaturaId é obrigatório' }, { status: 400 })
  }

  if (tipo === 'pagamento' && typeof valorPago !== 'number') {
    console.error('[push/send] tipo=pagamento exige valorPago numérico')
    return NextResponse.json({ error: 'valorPago é obrigatório para tipo=pagamento' }, { status: 400 })
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error(
      '[push/send] VAPID keys não configuradas no ambiente — ' +
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY ${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'presente' : 'AUSENTE'}, ` +
      `VAPID_PRIVATE_KEY ${process.env.VAPID_PRIVATE_KEY ? 'presente' : 'AUSENTE'}`
    )
    return NextResponse.json({ error: 'Push não configurado' }, { status: 500 })
  }

  // Plano de assinatura de cliente pago não tem agendamento nenhum por trás —
  // resolve prestadora/mensagem a partir da assinatura em vez de um agendamento.
  let prestadoraId: string
  let payload: string

  if (planoAssinaturaId) {
    const { data: assinatura, error: assinaturaError } = await supabaseAdmin
      .from('planos_assinaturas')
      .select('id, prestadora_id, planos_prestadora(nome), clientes(nome)')
      .eq('id', planoAssinaturaId)
      .maybeSingle() as { data: {
        id: string
        prestadora_id: string
        planos_prestadora: { nome: string } | null
        clientes: { nome: string } | null
      } | null, error: { message: string } | null }

    if (!assinatura) {
      console.error('[push/send] assinatura de plano não encontrada:', planoAssinaturaId, assinaturaError?.message)
      return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
    }

    console.log('[push/send] assinatura de plano encontrada — prestadora_id =', assinatura.prestadora_id)

    prestadoraId = assinatura.prestadora_id
    payload = JSON.stringify({
      title: 'Novo assinante!',
      body: `${assinatura.clientes?.nome ?? 'Uma cliente'} assinou o plano ${assinatura.planos_prestadora?.nome ?? ''} — ${formatCurrency(valorPago!)}`,
      icon: '/icon-512.png',
      url: '/painel/servicos',
      tipo: 'pagamento',
    })
  } else {
    const { data: agendamento, error: agendamentoError } = await supabaseAdmin
      .from('agendamentos')
      .select('id, data_hora, status, prestadora_id, servicos(nome, preco), clientes(nome), profissionais(nome)')
      .eq('id', agendamentoId)
      .single() as { data: {
        id: string
        data_hora: string
        status: string
        prestadora_id: string
        servicos: { nome: string; preco: number } | null
        clientes: { nome: string } | null
        profissionais: { nome: string } | null
      } | null, error: { message: string } | null }

    if (!agendamento) {
      console.error('[push/send] agendamento não encontrado:', agendamentoId, agendamentoError?.message)
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    console.log('[push/send] agendamento encontrado — prestadora_id =', agendamento.prestadora_id, 'status =', agendamento.status)

    prestadoraId = agendamento.prestadora_id

    const { servicos: servico, clientes: cliente, profissionais: profissional } = agendamento

    if (tipo === 'pagamento') {
      // Cobrou menos que o preço cheio do serviço → foi sinal; senão foi o
      // valor total — mesmo critério usado em processarPagamentoAgendamento
      // (src/app/api/mp/webhook/route.ts) pra decidir o tipo de lançamento no caixa.
      const souSinal = servico && valorPago! < servico.preco - 0.01
      payload = JSON.stringify({
        title: souSinal ? 'Sinal recebido!' : 'Pagamento recebido!',
        body: souSinal
          ? `${formatCurrency(valorPago!)} de sinal — ${servico?.nome ?? 'Serviço'}`
          : `${formatCurrency(valorPago!)} — ${servico?.nome ?? 'Serviço'} pago online`,
        icon: '/icon-512.png',
        url: '/painel/agendamentos',
        tipo: 'pagamento',
      })
      console.log('[push/send] payload de pagamento montado', { agendamentoId, souSinal, valorPago, payload })
    } else {
      const profNome = profissional?.nome ? ` com ${profissional.nome}` : ''
      const dataFormatada = formatDateShort(agendamento.data_hora)
      const isCancelamento = agendamento.status === 'cancelado'

      payload = JSON.stringify({
        title: isCancelamento ? 'Agendamento cancelado' : 'Novo agendamento!',
        body: isCancelamento
          ? `${cliente?.nome} cancelou ${servico?.nome}${profNome} em ${dataFormatada}`
          : `${cliente?.nome} agendou ${servico?.nome}${profNome} para ${dataFormatada}`,
        url: '/painel/agendamentos',
        tipo: 'agendamento',
      })
    }
  }

  const { data: subscriptionsRaw, error: subscriptionsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_agent, created_at')
    .eq('prestadora_id', prestadoraId) as { data: {
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

  console.log(`[push/send] ${subscriptionsRaw?.length ?? 0} subscription(s) encontrada(s) para prestadora ${prestadoraId}`)

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

  console.log(
    `[push/send] dedup: ${semDispositivoIdentificado.length} sem user_agent, ` +
    `${porDispositivo.size} grupo(s) de dispositivo distintos a partir de ${subscriptionsRaw.length} registro(s) brutos`
  )

  const subscriptions = [...semDispositivoIdentificado]
  const subscriptionsObsoletas: typeof subscriptionsRaw = []
  for (const grupo of porDispositivo.values()) {
    const ordenado = [...grupo].sort((a, b) => b.created_at.localeCompare(a.created_at))
    subscriptions.push(ordenado[0])
    subscriptionsObsoletas.push(...ordenado.slice(1))
  }

  console.log(
    `[push/send] após dedup: ${subscriptions.length} subscription(s) vão receber o envio ` +
    `(${subscriptionsObsoletas.length} obsoleta(s) descartada(s))`
  )

  if (subscriptionsObsoletas.length) {
    console.log(
      `[push/send] removendo ${subscriptionsObsoletas.length} subscription(s) duplicada(s) do mesmo dispositivo:`,
      subscriptionsObsoletas.map((s) => s.id)
    )
    await supabaseAdmin.from('push_subscriptions').delete().in('id', subscriptionsObsoletas.map((s) => s.id))
  }

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

  const sentWebPush = results.filter((r) => r.status === 'fulfilled').length
  console.log(`[push/send] web push concluído — ${sentWebPush}/${subscriptions.length} enviado(s) com sucesso`)

  const sentFcm = await enviarViaFcm(prestadoraId, payload)

  return NextResponse.json({ ok: true, sent: { webpush: sentWebPush, fcm: sentFcm } })
}

/**
 * Envio via FCM (app nativo Capacitor) em paralelo ao Web Push acima — mesmo
 * payload, mesma prestadora, canal independente. Retorna 0 sem erro se o FCM
 * não estiver configurado (Service Account ausente) ou a prestadora não tiver
 * nenhum token salvo — best-effort, mesmo espírito do resto desta rota.
 */
async function enviarViaFcm(prestadoraId: string, payload: string): Promise<number> {
  const messaging = getFcmMessaging()
  if (!messaging) {
    console.warn('[push/send][fcm] Service Account do Firebase não configurada — pulando envio nativo')
    return 0
  }

  const { data: tokensRaw, error: tokensError } = await supabaseAdmin
    .from('fcm_tokens')
    .select('id, token, user_agent, created_at')
    .eq('prestadora_id', prestadoraId) as { data: {
      id: string
      token: string
      user_agent: string | null
      created_at: string
    }[] | null, error: { message: string } | null }

  if (tokensError) {
    console.error('[push/send][fcm] erro ao buscar fcm_tokens:', tokensError.message)
    return 0
  }

  if (!tokensRaw?.length) {
    console.log(`[push/send][fcm] nenhum token FCM registrado para prestadora ${prestadoraId}`)
    return 0
  }

  // Mesmo dedup por dispositivo usado pra push_subscriptions logo acima — o
  // token do FCM também rotaciona, então o mesmo celular pode acumular vários.
  const porDispositivo = new Map<string, typeof tokensRaw>()
  const semDispositivoIdentificado: typeof tokensRaw = []
  for (const t of tokensRaw) {
    if (!t.user_agent) {
      semDispositivoIdentificado.push(t)
      continue
    }
    const grupo = porDispositivo.get(t.user_agent) ?? []
    grupo.push(t)
    porDispositivo.set(t.user_agent, grupo)
  }

  const tokens = [...semDispositivoIdentificado]
  const tokensObsoletos: typeof tokensRaw = []
  for (const grupo of porDispositivo.values()) {
    const ordenado = [...grupo].sort((a, b) => b.created_at.localeCompare(a.created_at))
    tokens.push(ordenado[0])
    tokensObsoletos.push(...ordenado.slice(1))
  }

  if (tokensObsoletos.length) {
    console.log(`[push/send][fcm] removendo ${tokensObsoletos.length} token(s) duplicado(s) do mesmo dispositivo`)
    await supabaseAdmin.from('fcm_tokens').delete().in('id', tokensObsoletos.map((t) => t.id))
  }

  const payloadObj = JSON.parse(payload) as { title?: string; body?: string; url?: string; tipo?: string }

  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: {
      title: payloadObj.title ?? 'BelleBook',
      body: payloadObj.body ?? '',
    },
    data: {
      url: payloadObj.url ?? '/painel/agendamentos',
      tipo: payloadObj.tipo ?? 'agendamento',
    },
  })

  const tokensInvalidos: string[] = []
  response.responses.forEach((r, i) => {
    if (r.success) {
      console.log(`[push/send][fcm] enviado com sucesso -> token ${tokens[i].id}`)
      return
    }
    const code = r.error?.code
    console.error(`[push/send][fcm] falha ao enviar -> token ${tokens[i].id}: ${code ?? r.error?.message}`)
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      tokensInvalidos.push(tokens[i].id)
    }
  })

  if (tokensInvalidos.length) {
    console.log(`[push/send][fcm] removendo ${tokensInvalidos.length} token(s) inválido(s)/expirado(s)`)
    await supabaseAdmin.from('fcm_tokens').delete().in('id', tokensInvalidos)
  }

  console.log(`[push/send][fcm] concluído — ${response.successCount}/${tokens.length} enviado(s) com sucesso`)
  return response.successCount
}
