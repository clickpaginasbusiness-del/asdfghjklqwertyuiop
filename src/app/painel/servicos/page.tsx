import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import ServicosClient, { type ServicoComProfissionais } from './ServicosClient'
import { planoEfetivo } from '@/lib/plano'
import { limitesPlano } from '@/lib/planoLimites'

export default async function ServicosPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  const podeUsarPlanos = limitesPlano(planoEfetivo(prestadora)).assinaturas_clientes

  const [{ data: servicos }, { data: profissionais }, { data: galeria }, { data: planos }] = await Promise.all([
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
    supabase
      .from('galeria')
      .select('*')
      .eq('prestadora_id', prestadora.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('planos_prestadora')
      .select('*, planos_servicos(id, servico_id, quantidade, servicos(nome)), planos_assinaturas(id, status)')
      .eq('prestadora_id', prestadora.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <ServicosClient
      servicos={(servicos ?? []) as unknown as ServicoComProfissionais[]}
      profissionais={profissionais ?? []}
      galeria={galeria ?? []}
      prestadoraId={prestadora.id}
      planosIniciais={planos ?? []}
      podeUsarPlanos={podeUsarPlanos}
    />
  )
}
