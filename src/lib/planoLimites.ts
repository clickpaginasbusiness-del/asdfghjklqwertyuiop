export type PlanoTier = 'start' | 'pro' | 'studio' | 'studio_pro'

export const PLANO_LIMITES = {
  start: {
    profissionais: 1,
    fotos_trabalhos: 4,
    fotos_estabelecimento: 0,
    whatsapp_utilidade: 0,
    whatsapp_marketing: 0,
    presets: false,
    assinaturas_clientes: false,
  },
  pro: {
    profissionais: 3,
    fotos_trabalhos: 8,
    fotos_estabelecimento: 8,
    whatsapp_utilidade: 280,
    whatsapp_marketing: 20,
    presets: false,
    assinaturas_clientes: false,
  },
  studio: {
    profissionais: Infinity,
    fotos_trabalhos: Infinity,
    fotos_estabelecimento: Infinity,
    whatsapp_utilidade: 650,
    whatsapp_marketing: 50,
    presets: true,
    assinaturas_clientes: true,
  },
  studio_pro: {
    profissionais: Infinity,
    fotos_trabalhos: Infinity,
    fotos_estabelecimento: Infinity,
    whatsapp_utilidade: 1420,
    whatsapp_marketing: 80,
    presets: true,
    assinaturas_clientes: true,
  },
} as const satisfies Record<PlanoTier, {
  profissionais: number
  fotos_trabalhos: number
  fotos_estabelecimento: number
  whatsapp_utilidade: number
  whatsapp_marketing: number
  presets: boolean
  assinaturas_clientes: boolean
}>

/** Limites do plano `null` (sem assinatura) — mais restritivo, tudo bloqueado. */
export const LIMITES_SEM_PLANO = {
  profissionais: 0,
  fotos_trabalhos: 0,
  fotos_estabelecimento: 0,
  whatsapp_utilidade: 0,
  whatsapp_marketing: 0,
  presets: false,
  assinaturas_clientes: false,
} as const

export function limitesPlano(plano: PlanoTier | null): typeof PLANO_LIMITES[PlanoTier] | typeof LIMITES_SEM_PLANO {
  return plano ? PLANO_LIMITES[plano] : LIMITES_SEM_PLANO
}
