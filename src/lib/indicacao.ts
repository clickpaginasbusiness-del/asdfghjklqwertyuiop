import type { SupabaseClient } from '@supabase/supabase-js'
import { darDiasGratis } from '@/lib/mercadopago'

/**
 * Recompensa de indicação — estágio 1: dá +7 dias ao referrer assim que a
 * pessoa indicada cria a conta. Chamada a partir dos dois pontos de cadastro
 * (complete-signup e google/completar) logo após o insert em `prestadoras`.
 *
 * O estágio 2 (+30 dias quando a indicada assina um plano) já existia e
 * continua tratado à parte, no webhook do Mercado Pago.
 */
export async function processarRecompensaCadastro(
  admin: SupabaseClient,
  novaPrestadoraId: string,
  novaPrestadoraNome: string,
  referrerId: string
): Promise<void> {
  try {
    // Marca como processada imediatamente para evitar double-reward
    await admin
      .from('prestadoras')
      .update({ indicacao_cadastro_processada: true })
      .eq('id', novaPrestadoraId)

    await darDiasGratis(admin, referrerId, 7, 'indicacao_estagio1')

    await admin.from('notificacoes').insert({
      prestadora_id: referrerId,
      tipo: 'indicacao',
      mensagem: `Sua indicada ${novaPrestadoraNome} criou uma conta! Você ganhou +7 dias grátis 🎉`,
    })
  } catch (err) {
    console.error('[indicacao] erro ao processar recompensa de cadastro', novaPrestadoraId, err)
  }
}
