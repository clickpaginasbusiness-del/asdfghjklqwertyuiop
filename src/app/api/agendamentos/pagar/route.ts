import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { preference } from '@/lib/mercadopago'
import { calcularValorSinal } from '@/lib/sinal'

type MetodoPagamento = 'cartao' | 'pix' | 'debito'
const METODOS_VALIDOS = new Set<MetodoPagamento>(['cartao', 'pix', 'debito'])

/**
 * Cria a cobrança (sinal ou valor total do serviço) do agendamento
 * temporário criado em /api/agendamentos/criar-pendente. O valor a cobrar
 * nunca vem do cliente — é recalculado aqui a partir da configuração do
 * serviço, igual à página pública, pra não confiar em nada vindo do front.
 */
export async function POST(request: NextRequest) {
  let body: { agendamentoId?: string; metodo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { agendamentoId } = body
  const metodo = body.metodo as MetodoPagamento
  if (!agendamentoId || !METODOS_VALIDOS.has(metodo)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: agendamento } = await admin
    .from('agendamentos')
    .select('id, status, servicos(nome, preco, sinal_tipo, sinal_valor, sinal_obrigatorio, aceitar_pagamento_online), clientes(nome, telefone)')
    .eq('id', agendamentoId)
    .eq('status', 'aguardando_pagamento')
    .maybeSingle()

  const servico = agendamento?.servicos as unknown as
    | { nome: string; preco: number; sinal_tipo: 'fixo' | 'percentual' | null; sinal_valor: number | null; sinal_obrigatorio: boolean; aceitar_pagamento_online: boolean }
    | null
  const cliente = agendamento?.clientes as unknown as { nome: string; telefone: string | null } | null

  if (!agendamento || !servico?.aceitar_pagamento_online) {
    return NextResponse.json({ error: 'Agendamento não encontrado ou já processado.' }, { status: 404 })
  }

  const valor = servico.sinal_obrigatorio
    ? calcularValorSinal(servico.preco, servico.sinal_tipo, servico.sinal_valor)
    : servico.preco

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

  const titulo = servico.sinal_obrigatorio ? `Sinal — ${servico.nome}` : servico.nome

  // Cliente não tem email no sistema (só telefone) — manda nome/telefone
  // como payer mesmo assim. Sem isso a Preference ia sem nenhum dado de
  // identificação do comprador, diferente do checkout de assinatura (que
  // sempre manda payer.email).
  const digitos = cliente?.telefone?.replace(/\D/g, '') ?? ''
  const payer = cliente
    ? {
        name: cliente.nome,
        ...(digitos.length >= 10 ? { phone: { area_code: digitos.slice(0, 2), number: digitos.slice(2) } } : {}),
      }
    : undefined

  try {
    const pref = await preference.create({
      body: {
        items: [{ id: `agendamento_${agendamentoId}`, title: titulo, quantity: 1, unit_price: valor, currency_id: 'BRL', category_id: 'services' }],
        ...(payer ? { payer } : {}),
        back_urls: {
          success: `${appUrl}/agendamento/checkout?agendamento_temp=${agendamentoId}&pago=1`,
          failure: `${appUrl}/agendamento/checkout?agendamento_temp=${agendamentoId}`,
          pending: `${appUrl}/agendamento/checkout?agendamento_temp=${agendamentoId}&pago=1`,
        },
        auto_return: 'approved',
        external_reference: agendamentoId,
        binary_mode: false,
        ...(metodo !== 'cartao' ? { payment_methods: { excluded_payment_types: [{ id: 'credit_card' as const }] } } : {}),
      },
    })

    return NextResponse.json({ url: pref.init_point })
  } catch (err) {
    console.error('[agendamentos/pagar] erro ao criar cobrança', agendamentoId, err)
    return NextResponse.json({ error: 'Erro ao iniciar pagamento' }, { status: 500 })
  }
}
