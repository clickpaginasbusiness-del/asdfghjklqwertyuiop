import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RelatoriosClient, { type Ag } from './RelatoriosClient'

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano, hora_abertura, hora_fechamento')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const plano = (prestadora.plano as 'basico' | 'pro' | null) ?? null

  if (plano === 'basico') {
    return (
      <RelatoriosClient
        plano="basico"
        agendamentos={[]}
        profissionais={[]}
        visitas={[]}
        horaAbertura="09:00"
        horaFechamento="18:00"
      />
    )
  }

  const [
    { data: agendamentos },
    { data: profissionais },
    { data: visitas },
  ] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id, data_hora, created_at, status, servicos(nome, preco), clientes(id, nome), profissionais(nome)')
      .eq('prestadora_id', prestadora.id)
      .order('data_hora'),
    supabase
      .from('profissionais')
      .select('id, nome')
      .eq('prestadora_id', prestadora.id),
    supabase
      .from('visitas_pagina')
      .select('id, created_at')
      .eq('prestadora_id', prestadora.id),
  ])

  return (
    <RelatoriosClient
      plano="pro"
      agendamentos={(agendamentos ?? []) as unknown as Ag[]}
      profissionais={profissionais ?? []}
      visitas={visitas ?? []}
      horaAbertura={prestadora.hora_abertura}
      horaFechamento={prestadora.hora_fechamento}
    />
  )
}
