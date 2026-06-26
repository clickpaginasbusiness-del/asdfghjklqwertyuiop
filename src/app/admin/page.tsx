import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminClient from './AdminClient'

const ADMIN_EMAIL = 'clickpaginasbusiness@gmail.com'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/painel')

  const admin = createAdminClient()
  const { data: prestadoras } = await admin
    .from('prestadoras')
    .select('id, nome, email, plano, assinatura_ativa, trial_fim, e_trial, created_at, stripe_customer_id')
    .order('created_at', { ascending: false })

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
    />
  )
}
