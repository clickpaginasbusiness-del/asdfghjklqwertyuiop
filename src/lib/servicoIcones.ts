import {
  Scissors, Sparkles, Eye, Flower, Star, Heart, Zap, Crown, Leaf, Brush, Hand, Sun, Droplets, Gem, Palette, Wand2,
  type LucideIcon,
} from 'lucide-react'

export const SERVICO_ICONES = {
  Scissors, Sparkles, Eye, Flower, Star, Heart, Zap, Crown, Leaf, Brush, Hand, Sun, Droplets, Gem, Palette, Wand2,
} satisfies Record<string, LucideIcon>

export type ServicoIcone = keyof typeof SERVICO_ICONES

export const SERVICO_ICONE_PADRAO: ServicoIcone = 'Scissors'

export const SERVICO_ICONE_OPTIONS = Object.keys(SERVICO_ICONES) as ServicoIcone[]

export function getServicoIcone(nome: string | null | undefined): LucideIcon {
  if (nome && nome in SERVICO_ICONES) return SERVICO_ICONES[nome as ServicoIcone]
  return Scissors
}
