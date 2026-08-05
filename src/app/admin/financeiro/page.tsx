import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import FinanceiroAdminClient from './FinanceiroAdminClient'

export default async function FinanceiroAdminPage() {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()

  const [{ data: caixaRows }, { data: saques }] = await Promise.all([
    admin
      .from('caixa_prestadora')
      .select('id, prestadora_id, tipo, valor, valor_bruto, status, created_at, prestadoras(nome)')
      .order('created_at', { ascending: false }),
    admin
      .from('caixa_saques')
      .select('id, prestadora_id, valor, status, pago_em, solicitado_em')
      .order('solicitado_em', { ascending: false }),
  ])

  const caixa = (caixaRows ?? []).map((c) => {
    const prestadora = c.prestadoras as unknown as { nome: string } | null
    return {
      id: c.id,
      prestadoraId: c.prestadora_id,
      prestadoraNome: prestadora?.nome ?? '—',
      tipo: c.tipo as 'sinal' | 'pagamento_servico' | 'saque',
      valor: c.valor,
      valorBruto: c.valor_bruto,
      status: c.status as 'pendente' | 'disponivel' | 'sacado' | 'reembolsado',
      createdAt: c.created_at,
    }
  })

  const saquesLinhas = (saques ?? []).map((s) => ({
    id: s.id,
    prestadoraId: s.prestadora_id,
    valor: s.valor,
    status: s.status as 'solicitado' | 'pago',
    pagoEm: s.pago_em,
    solicitadoEm: s.solicitado_em,
  }))

  return <FinanceiroAdminClient caixa={caixa} saques={saquesLinhas} />
}
