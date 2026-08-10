import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'
import { getOrCreatePreapprovalPlanoCliente, preApprovalPlan, preference } from '@/lib/mercadopago'
import { payerEmailPlanoCliente } from '@/lib/planosPrestadora'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

type Metodo = 'cartao' | 'pix'
const METODOS_VALIDOS = new Set<Metodo>(['cartao', 'pix'])

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planoId } = await params

  let body: { token?: string; metodo?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const session = verifyClientToken(body.token)
  if (!session) return NextResponse.json({ error: 'Faça login para assinar.' }, { status: 401 })

  const metodo = body.metodo as Metodo
  if (!METODOS_VALIDOS.has(metodo)) return NextResponse.json({ error: 'Método inválido' }, { status: 400 })

  const admin = createAdminClient()

  const { data: plano } = await admin
    .from('planos_prestadora')
    .select('*, prestadoras(nome, slug, email)')
    .eq('id', planoId)
    .eq('ativo', true)
    .maybeSingle()

  if (!plano) return NextResponse.json({ error: 'Plano não encontrado ou inativo.' }, { status: 404 })

  const prestadora = plano.prestadoras as unknown as { nome: string; slug: string; email: string } | null
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada.' }, { status: 404 })

  // Vagas: conta assinaturas ativas (não a própria cliente, se ela já tiver
  // cancelado e estiver reassinando).
  if (plano.limite_vagas != null) {
    const { count } = await admin
      .from('planos_assinaturas')
      .select('id', { count: 'exact', head: true })
      .eq('plano_id', planoId)
      .eq('status', 'ativa')
    if ((count ?? 0) >= plano.limite_vagas) {
      return NextResponse.json({ error: 'Esse plano está com as vagas esgotadas.' }, { status: 409 })
    }
  }

  const { data: existente } = await admin
    .from('planos_assinaturas')
    .select('id, status')
    .eq('plano_id', planoId)
    .eq('cliente_id', session.clienteId)
    .maybeSingle()
  if (existente?.status === 'ativa') {
    return NextResponse.json({ error: 'Você já tem uma assinatura ativa desse plano.' }, { status: 409 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

  const payerEmail = payerEmailPlanoCliente(planoId, session.clienteId)

  try {
    if (metodo === 'cartao') {
      // Checkout hospedado do MP (mesmo padrão da assinatura da prestadora
      // com o BelleBook) — o preapproval em si é criado do lado do MP quando
      // a cliente completa o cartão nessa página, não aqui.
      const preapprovalPlanId = await getOrCreatePreapprovalPlanoCliente(admin, plano, prestadora.slug)
      const planoCompleto = await preApprovalPlan.get({ preApprovalPlanId: preapprovalPlanId })
      if (!planoCompleto.init_point) throw new Error('Plano sem init_point')

      const url = `${planoCompleto.init_point}&payer_email=${encodeURIComponent(payerEmail)}`
      return NextResponse.json({ url })
    }

    // Pix: sem recorrência automática nativa nesse projeto (mesma limitação
    // já assumida pra assinatura Pix da prestadora — ver src/lib/mercadopago.ts)
    // — cobrança avulsa via Preference, renovada pelo cron a cada ciclo (ver
    // /api/cron/mp-renovacoes). external_reference aqui é 100% confiável
    // (diferente do preapproval hospedado), então é o que o webhook usa pra
    // identificar que esse pagamento é de um plano de cliente.
    const referencia = `plano_cliente:${planoId}:${session.clienteId}:${randomUUID()}`
    const pref = await preference.create({
      body: {
        items: [{ id: `plano_${planoId}`, title: `Plano ${plano.nome} — ${prestadora.nome}`, quantity: 1, unit_price: plano.preco, currency_id: 'BRL' }],
        payer: { email: payerEmail },
        back_urls: {
          success: `${appUrl}/n/${prestadora.slug}?assinatura=sucesso`,
          failure: `${appUrl}/n/${prestadora.slug}`,
          pending: `${appUrl}/n/${prestadora.slug}`,
        },
        auto_return: 'approved',
        external_reference: referencia,
        payment_methods: { excluded_payment_types: [{ id: 'credit_card' }] },
      },
    })

    return NextResponse.json({ url: pref.init_point })
  } catch (err) {
    console.error('[planos/assinar] erro ao criar cobrança', planoId, err)
    return NextResponse.json({ error: 'Erro ao iniciar assinatura' }, { status: 500 })
  }
}
