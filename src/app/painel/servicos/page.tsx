import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ServicosClient, { type ServicoComProfissionais } from './ServicosClient'

export default async function ServicosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const [{ data: servicos }, { data: profissionais }] = await Promise.all([
    supabase
      .from('servicos')
      .select('*, servico_profissionais(profissional_id)')
      .eq('prestadora_id', prestadora.id)
      .order('created_at'),
    supabase
      .from('profissionais')
      .select('id, nome')
      .eq('prestadora_id', prestadora.id)
      .eq('ativa', true)
      .order('nome'),
  ])

  return (
    <ServicosClient
      servicos={(servicos ?? []) as unknown as ServicoComProfissionais[]}
      profissionais={profissionais ?? []}
      prestadoraId={prestadora.id}
    />
  )
}
