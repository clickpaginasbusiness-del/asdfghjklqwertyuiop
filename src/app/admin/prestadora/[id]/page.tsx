import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import PrestadoraDetalheClient from './PrestadoraDetalheClient'

export default async function PrestadoraDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()

  const [{ data: prestadora }, { data: agendamentos }, { count: totalServicos }] = await Promise.all([
    admin
      .from('prestadoras')
      .select('id, nome, email, telefone, slug, created_at, plano, assinatura_ativa, trial_fim, e_trial, last_seen_at, stripe_customer_id')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('agendamentos')
      .select('id, cliente_id')
      .eq('prestadora_id', id),
    admin
      .from('servicos')
      .select('*', { count: 'exact', head: true })
      .eq('prestadora_id', id),
  ])

  if (!prestadora) notFound()

  const totalAgendamentos = agendamentos?.length ?? 0
  const totalClientes = new Set((agendamentos ?? []).map(a => a.cliente_id)).size

  return (
    <PrestadoraDetalheClient
      prestadora={prestadora}
      totalAgendamentos={totalAgendamentos}
      totalClientes={totalClientes}
      totalServicos={totalServicos ?? 0}
    />
  )
}
