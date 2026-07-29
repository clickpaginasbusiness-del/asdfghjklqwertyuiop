/** Parceira tem acesso Pro liberado pelo cargo, mesmo sem plano='pro' sincronizado — usa isso em vez do campo `plano` cru em qualquer lugar que decide o que é feature Pro. */
export function planoEfetivo(p: { plano: 'basico' | 'pro' | null; e_parceira: boolean }): 'basico' | 'pro' | null {
  return p.e_parceira ? 'pro' : p.plano
}
