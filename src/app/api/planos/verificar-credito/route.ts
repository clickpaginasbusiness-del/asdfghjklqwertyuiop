import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'
import { buscarAssinaturaComCredito } from '@/lib/planosPrestadora'
import { NextRequest, NextResponse } from 'next/server'

/** Checa se a cliente logada tem uma assinatura com crédito pro serviço
 * selecionado — usado no passo de confirmação do agendamento pra mostrar o
 * badge "Plano [Nome]" e a opção de usar o crédito. Não decrementa nada
 * aqui, só consulta (o consumo real acontece em /api/agendamentos/criar ou
 * na confirmação do pagamento, ver aplicarUsoCredito). */
export async function POST(request: NextRequest) {
  let body: { token?: string; prestadoraId?: string; servicoId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const session = verifyClientToken(body.token)
  if (!session) return NextResponse.json({ error: 'Faça login.' }, { status: 401 })
  if (!body.prestadoraId || !body.servicoId) {
    return NextResponse.json({ error: 'prestadoraId e servicoId são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const assinatura = await buscarAssinaturaComCredito(admin, {
    clienteId: session.clienteId,
    prestadoraId: body.prestadoraId,
    servicoId: body.servicoId,
  })

  if (!assinatura) return NextResponse.json({ assinatura: null })

  return NextResponse.json({
    assinatura: {
      id: assinatura.id,
      // creditoDisponivel já é o número certo pro serviço pedido — linha
      // por serviço quando o plano tem planos_servicos, agregado quando é
      // genérico (ver buscarAssinaturaComCredito).
      creditosRestantes: assinatura.creditoDisponivel,
      planoNome: assinatura.plano.nome,
      descontoTipo: assinatura.plano.desconto_tipo,
      descontoValor: assinatura.plano.desconto_valor,
    },
  })
}
