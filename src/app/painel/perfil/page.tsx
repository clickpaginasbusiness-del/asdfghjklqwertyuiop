import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PerfilPainelClient, { type AvaliacaoComCliente } from './PerfilPainelClient'

export default async function PerfilPainelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const { data: avaliacoes } = await supabase
    .from('avaliacoes')
    .select('id, nota, comentario, destaque, created_at, agendamentos(clientes(nome), servicos(nome))')
    .eq('prestadora_id', prestadora.id)
    .order('created_at', { ascending: false })

  return (
    <PerfilPainelClient
      prestadora={prestadora}
      avaliacoes={(avaliacoes ?? []) as unknown as AvaliacaoComCliente[]}
    />
  )
}
