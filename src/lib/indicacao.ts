import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000
const SETE_DIAS_SEGUNDOS = 7 * 24 * 60 * 60

/**
 * Recompensa de indicação — estágio 1: dá +7 dias ao referrer assim que a
 * pessoa indicada cria a conta. Chamada a partir dos dois pontos de cadastro
 * (complete-signup e google/completar) logo após o insert em `prestadoras`.
 *
 * O estágio 2 (+30 dias quando a indicada assina um plano) já existia e
 * continua tratado à parte, no webhook do Stripe em checkout.session.completed.
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

    const { data: referrer } = await admin
      .from('prestadoras')
      .select('id, stripe_subscription_id, plano, assinatura_ativa, e_trial, trial_fim')
      .eq('id', referrerId)
      .single()

    if (!referrer) return

    if (referrer.assinatura_ativa && !referrer.e_trial && referrer.stripe_subscription_id) {
      // Plano pago → pausa a cobrança por 7 dias (mesma lógica do estágio 2, com prazo menor)
      const trialEndUnix = Math.floor(Date.now() / 1000) + SETE_DIAS_SEGUNDOS
      await stripe.subscriptions.update(referrer.stripe_subscription_id, { trial_end: trialEndUnix })
      await admin
        .from('prestadoras')
        .update({ trial_fim: new Date(trialEndUnix * 1000).toISOString() })
        .eq('id', referrer.id)
    } else if (referrer.assinatura_ativa && referrer.e_trial && referrer.trial_fim) {
      // Trial ativo → estende 7 dias
      const base = new Date(referrer.trial_fim)
      const newEnd = new Date(Math.max(base.getTime(), Date.now()) + SETE_DIAS_MS)
      await admin.from('prestadoras').update({ trial_fim: newEnd.toISOString() }).eq('id', referrer.id)
    } else {
      // Sem plano / expirado → trial de 7 dias grátis
      const newEnd = new Date(Date.now() + SETE_DIAS_MS)
      await admin.from('prestadoras').update({
        assinatura_ativa: true,
        plano: 'basico',
        e_trial: true,
        trial_fim: newEnd.toISOString(),
      }).eq('id', referrer.id)
    }

    await admin.from('notificacoes').insert({
      prestadora_id: referrer.id,
      tipo: 'indicacao',
      mensagem: `Sua indicada ${novaPrestadoraNome} criou uma conta! Você ganhou +7 dias grátis 🎉`,
    })
  } catch (err) {
    console.error('[indicacao] erro ao processar recompensa de cadastro', novaPrestadoraId, err)
  }
}
