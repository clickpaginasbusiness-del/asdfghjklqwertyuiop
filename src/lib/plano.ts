import type { PlanoTier } from './planoLimites'

export type Plano = PlanoTier

/** Parceira tem acesso Studio liberado pelo cargo, mesmo sem plano='studio' sincronizado — usa isso em vez do campo `plano` cru em qualquer lugar que decide o que é feature paga. */
export function planoEfetivo(p: { plano: Plano | null; e_parceira: boolean }): Plano | null {
  return p.e_parceira ? 'studio' : p.plano
}

/** Features "Pro" — liberadas a partir do plano Pro (inclusive Studio). */
export function ehPro(plano: Plano | null): boolean {
  return plano === 'pro' || plano === 'studio'
}

/** Features "Studio" — liberadas a partir do plano Studio, o topo de tabela. */
export function ehStudio(plano: Plano | null): boolean {
  return plano === 'studio'
}
