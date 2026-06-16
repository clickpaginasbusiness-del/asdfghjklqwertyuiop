import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

export const PRICE_IDS = {
  basico:       process.env.STRIPE_PRICE_BASICO!,
  pro:          process.env.STRIPE_PRICE_PRO!,
  basico_anual: process.env.STRIPE_PRICE_BASICO_ANUAL!,
  pro_anual:    process.env.STRIPE_PRICE_PRO_ANUAL!,
}

export type PriceKey = keyof typeof PRICE_IDS

/** Retorna 'basico' | 'pro' a partir de qualquer price ID (mensal ou anual) */
export function planByPrice(priceId: string): 'basico' | 'pro' | null {
  if (priceId === PRICE_IDS.basico || priceId === PRICE_IDS.basico_anual) return 'basico'
  if (priceId === PRICE_IDS.pro   || priceId === PRICE_IDS.pro_anual)   return 'pro'
  return null
}

/** Retorna true se o price ID corresponde a um plano anual */
export function isAnualByPrice(priceId: string): boolean {
  return priceId === PRICE_IDS.basico_anual || priceId === PRICE_IDS.pro_anual
}
