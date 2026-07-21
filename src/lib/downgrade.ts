import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Efeitos de desabilitar as features exclusivas do Pro — chamado sempre que uma
 * prestadora deixa de ser Pro (downgrade real via Stripe ou trial Pro expirado).
 * Não mexe em `plano`/`assinatura_ativa`/campos do Stripe — isso fica a cargo de
 * quem chama, já que varia por contexto (webhook, expiração de trial, etc.).
 */
export async function aplicarDowngradeParaBasico(supabase: SupabaseClient, prestadoraId: string): Promise<void> {
  // Profissionais: mantém só a mais antiga ativa (o Básico permite 1 só).
  // Continuam todas cadastradas no banco — só o status `ativa` muda, então nada
  // se perde e ela pode escolher outra pra deixar ativa depois.
  const { data: ativas } = await supabase
    .from('profissionais')
    .select('id')
    .eq('prestadora_id', prestadoraId)
    .eq('ativa', true)
    .order('created_at', { ascending: true })

  if (ativas && ativas.length > 1) {
    const idsDesativar = (ativas as { id: string }[]).slice(1).map((p) => p.id)
    await supabase.from('profissionais').update({ ativa: false }).in('id', idsDesativar)
  }

  // Avaliações em destaque: limpa a curadoria — ao voltar pro Pro ela escolhe de
  // novo quais mostrar, em vez de reaparecerem destaques antigos sem aviso.
  await supabase
    .from('avaliacoes')
    .update({ destaque: false })
    .eq('prestadora_id', prestadoraId)
    .eq('destaque', true)

  // Cor tema: volta pro padrão — a página pública já bloqueia escolher outra
  // cor no Básico, mas sem isso uma cor Pro escolhida antes continuaria valendo.
  await supabase
    .from('prestadoras')
    .update({ cor_tema: 'rosa' })
    .eq('id', prestadoraId)

  // Galeria: as fotos continuam salvas — a página pública já esconde a seção
  // fora do Pro (gate por `prestadora.plano`), sem precisar apagar nada aqui.
}
