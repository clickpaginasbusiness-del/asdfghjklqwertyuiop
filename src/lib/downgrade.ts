import type { SupabaseClient } from '@supabase/supabase-js'
import { PLANO_LIMITES, type PlanoTier } from './planoLimites'
import { ehPro } from './plano'

/**
 * Efeitos de uma prestadora cair pra um plano mais restrito (downgrade real via
 * Mercado Pago, trial Pro expirado, simulação de admin, remoção de cargo de
 * parceira etc.) — desativa profissionais além do limite do novo plano e, só
 * quando o novo plano não é mais "Pro" pra cima (ver `ehPro`), limpa avaliações
 * em destaque e reseta a cor do tema (features exclusivas do Pro+). Não mexe em
 * `plano`/`assinatura_ativa`/campos do MP — isso fica a cargo de quem chama, já
 * que varia por contexto (webhook, expiração de trial, etc.).
 */
export async function aplicarRestricoesDoPlano(
  supabase: SupabaseClient,
  prestadoraId: string,
  planoNovo: PlanoTier
): Promise<void> {
  // Profissionais: mantém só as N mais antigas ativas, N = limite do novo
  // plano (Infinity nos planos Studio = nunca desativa ninguém). Continuam
  // todas cadastradas no banco — só o status `ativa` muda, então nada se
  // perde e ela pode escolher outras pra deixar ativas depois.
  const limiteProfissionais = PLANO_LIMITES[planoNovo].profissionais
  if (limiteProfissionais !== Infinity) {
    const { data: ativas } = await supabase
      .from('profissionais')
      .select('id')
      .eq('prestadora_id', prestadoraId)
      .eq('ativa', true)
      .order('created_at', { ascending: true })

    if (ativas && ativas.length > limiteProfissionais) {
      const idsDesativar = (ativas as { id: string }[]).slice(limiteProfissionais).map((p) => p.id)
      await supabase.from('profissionais').update({ ativa: false }).in('id', idsDesativar)
    }
  }

  if (!ehPro(planoNovo)) {
    // Avaliações em destaque: limpa a curadoria — ao voltar pro Pro+ ela
    // escolhe de novo quais mostrar, em vez de reaparecerem destaques antigos
    // sem aviso.
    await supabase
      .from('avaliacoes')
      .update({ destaque: false })
      .eq('prestadora_id', prestadoraId)
      .eq('destaque', true)

    // Cor tema: volta pro padrão — a página pública já bloqueia escolher outra
    // cor fora do Pro+, mas sem isso uma cor escolhida antes continuaria valendo.
    await supabase
      .from('prestadoras')
      .update({ cor_tema: 'rosa' })
      .eq('id', prestadoraId)
  }

  // Galeria de trabalhos/estabelecimento: as fotos e ids selecionados
  // continuam salvos — a página pública já respeita o limite de fotos do
  // plano atual ao exibir (slice), sem precisar apagar nada aqui.
}
