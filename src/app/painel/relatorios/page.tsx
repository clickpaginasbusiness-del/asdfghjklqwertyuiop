import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import { getResumoParceira } from '@/lib/parceiras'
import { getResumoPlanos } from '@/lib/planosPrestadora'
import RelatoriosClient, { type Ag, type AvaliacaoRel, type LancamentoFinanceiro } from './RelatoriosClient'

export default async function RelatoriosPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  // Nenhuma dessas 7 consultas depende do resultado de outra — todas juntas
  // no mesmo Promise.all (resumoParceira/resumoPlanos usavam o cliente
  // admin e rodavam sozinhas, sequencialmente, antes das outras 5 nem
  // começarem a disparar).
  const [
    resumoParceira,
    resumoPlanos,
    { data: agendamentos },
    { data: profissionais },
    { data: visitas },
    { data: avaliacoes },
    { data: lancamentos },
  ] = await Promise.all([
    // Resumo de parceira usa o cliente admin (não o autenticado por RLS)
    // porque liberar comissões vencidas exige um UPDATE, e a policy de
    // parceiras_comissoes só permite SELECT da própria prestadora.
    prestadora.e_parceira ? getResumoParceira(createAdminClient(), prestadora.id) : Promise.resolve(null),
    // getResumoPlanos usa o cliente admin pelo mesmo motivo: agrega receita
    // histórica de caixa_prestadora entre planos, fora do escopo de uma
    // única RLS SELECT simples.
    getResumoPlanos(createAdminClient(), prestadora.id),
    supabase
      .from('agendamentos')
      .select('id, data_hora, created_at, status, servicos(nome, preco), clientes(id, nome), profissionais(nome)')
      .eq('prestadora_id', prestadora.id)
      .order('data_hora'),
    supabase
      .from('profissionais')
      .select('id, nome, comissao_percentual')
      .eq('prestadora_id', prestadora.id),
    supabase
      .from('visitas_pagina')
      .select('id, created_at')
      .eq('prestadora_id', prestadora.id),
    supabase
      .from('avaliacoes')
      .select('id, nota, comentario, created_at, agendamentos(clientes(nome), servicos(nome))')
      .eq('prestadora_id', prestadora.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('lancamentos_financeiros')
      .select('id, descricao, valor, categoria, data, created_at')
      .eq('prestadora_id', prestadora.id)
      .order('data', { ascending: false }),
  ])

  return (
    <RelatoriosClient
      prestadoraId={prestadora.id}
      agendamentos={(agendamentos ?? []) as unknown as Ag[]}
      profissionais={profissionais ?? []}
      visitas={visitas ?? []}
      avaliacoes={(avaliacoes ?? []) as unknown as AvaliacaoRel[]}
      lancamentos={(lancamentos ?? []) as unknown as LancamentoFinanceiro[]}
      horaAbertura={prestadora.hora_abertura}
      horaFechamento={prestadora.hora_fechamento}
      eParceira={prestadora.e_parceira}
      codigoIndicacao={prestadora.codigo_indicacao}
      resumoParceira={resumoParceira}
      resumoPlanos={resumoPlanos}
    />
  )
}
