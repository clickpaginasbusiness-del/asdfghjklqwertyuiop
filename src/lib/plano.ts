import type { PlanoTier } from './planoLimites'

export type Plano = PlanoTier

/** Parceira tem acesso Pro liberado pelo cargo, mesmo sem plano='pro' sincronizado — usa isso em vez do campo `plano` cru em qualquer lugar que decide o que é feature paga. Mantém o mesmo nível de benefício histórico (Pro), não o topo da tabela — cargo de parceira nunca foi pensado como "Studio Pro grátis". */
export function planoEfetivo(p: { plano: Plano | null; e_parceira: boolean }): Plano | null {
  return p.e_parceira ? 'pro' : p.plano
}

/** Features "Pro" — liberadas a partir do plano Pro (inclusive Studio e Studio Pro). */
export function ehPro(plano: Plano | null): boolean {
  return plano === 'pro' || plano === 'studio' || plano === 'studio_pro'
}

/** Features "Studio" — liberadas a partir do plano Studio (inclusive Studio Pro). */
export function ehStudio(plano: Plano | null): boolean {
  return plano === 'studio' || plano === 'studio_pro'
}

/** Features exclusivas do topo de tabela. */
export function ehStudioPro(plano: Plano | null): boolean {
  return plano === 'studio_pro'
}
