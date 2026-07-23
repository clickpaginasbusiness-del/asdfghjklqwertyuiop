import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()
  const [{ data: prestadoras }, { data: feedbacks }] = await Promise.all([
    admin
      .from('prestadoras')
      .select('id, nome, email, plano, assinatura_ativa, trial_fim, e_trial, created_at, stripe_customer_id, last_seen_at')
      .order('created_at', { ascending: false }),
    admin
      .from('feedbacks_prestadora')
      .select('id, nome_prestadora, email_prestadora, nota, comentario, created_at')
      .order('created_at', { ascending: false }),
  ])

  const all = prestadoras ?? []
  const now = new Date()

  const emTrialAtivo = all.filter(p =>
    p.e_trial && p.assinatura_ativa && p.trial_fim && new Date(p.trial_fim) > now
  ).length

  const pagasBasico = all.filter(p =>
    !p.e_trial && p.assinatura_ativa && p.plano === 'basico'
  ).length

  const pagasPro = all.filter(p =>
    !p.e_trial && p.assinatura_ativa && p.plano === 'pro'
  ).length

  const semPlanOuExpirado = all.length - emTrialAtivo - pagasBasico - pagasPro
  const receitaEstimada = pagasBasico * 49 + pagasPro * 89

  // Gráfico: últimos 30 dias
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })
  const byDay: Record<string, number> = {}
  last30.forEach(d => (byDay[d] = 0))
  all.forEach(p => {
    const day = p.created_at.split('T')[0]
    if (day in byDay) byDay[day]++
  })
  const chartData = last30.map(d => ({ date: d, count: byDay[d] }))

  return (
    <AdminClient
      prestadoras={all}
      metrics={{ total: all.length, emTrialAtivo, pagasBasico, pagasPro, semPlanOuExpirado, receitaEstimada }}
      chartData={chartData}
      feedbacks={feedbacks ?? []}
    />
  )
}
